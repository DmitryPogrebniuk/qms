import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';
import * as https from 'https';

export interface IntegrationConfig {
  type: string;
  settings: Record<string, any>;
  enabled: boolean;
  configured: boolean;
  lastTestAt?: Date;
  lastTestSuccess?: boolean;
  lastTestError?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Field definitions for each integration type
const INTEGRATION_FIELDS: Record<string, { key: string; secret: boolean; label: string }[]> = {
  uccx: [
    { key: 'host', secret: false, label: 'UCCX Host' },
    { key: 'port', secret: false, label: 'Port' },
    { key: 'username', secret: false, label: 'Username' },
    { key: 'password', secret: true, label: 'Password' },
    { key: 'timeout', secret: false, label: 'Timeout (ms)' },
    { key: 'allowSelfSigned', secret: false, label: 'Allow Self-Signed Certificates' },
  ],
  mediasense: [
    { key: 'apiUrl', secret: false, label: 'API URL' },
    { key: 'apiKey', secret: false, label: 'API Key (Username)' },
    { key: 'apiSecret', secret: true, label: 'API Secret (Password)' },
    { key: 'allowSelfSigned', secret: false, label: 'Allow Self-Signed Certificates' },
  ],
  opensearch: [
    { key: 'host', secret: false, label: 'Host' },
    { key: 'port', secret: false, label: 'Port' },
    { key: 'username', secret: false, label: 'Username' },
    { key: 'password', secret: true, label: 'Password' },
    { key: 'indexPrefix', secret: false, label: 'Index Prefix' },
    { key: 'tls', secret: false, label: 'Use TLS' },
  ],
  email: [
    { key: 'smtpHost', secret: false, label: 'SMTP Host' },
    { key: 'smtpPort', secret: false, label: 'SMTP Port' },
    { key: 'smtpUsername', secret: false, label: 'Username' },
    { key: 'smtpPassword', secret: true, label: 'Password' },
    { key: 'fromAddress', secret: false, label: 'From Address' },
    { key: 'fromName', secret: false, label: 'From Name' },
    { key: 'useTls', secret: false, label: 'Use TLS' },
  ],
  keycloak: [
    { key: 'realmUrl', secret: false, label: 'Realm URL' },
    { key: 'realm', secret: false, label: 'Realm' },
    { key: 'clientId', secret: false, label: 'Client ID' },
    { key: 'clientSecret', secret: true, label: 'Client Secret' },
  ],
};

@Injectable()
export class IntegrationsService implements OnModuleInit {
  private readonly logger = new Logger('IntegrationsService');
  private readonly encryptionKey: Buffer;
  private readonly encryptionAlgorithm = 'aes-256-gcm';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Generate encryption key from JWT_SECRET or use default
    const secret = this.configService.get<string>('JWT_SECRET') || 'default-secret-change-me';
    this.encryptionKey = crypto.scryptSync(secret, 'salt', 32);
  }

  async onModuleInit() {
    // Initialize default integration records if they don't exist
    await this.initializeDefaultIntegrations();
  }

  /**
   * Initialize default integration records in database
   */
  private async initializeDefaultIntegrations(): Promise<void> {
    const types = ['uccx', 'mediasense', 'opensearch', 'email', 'keycloak'];

    for (const type of types) {
      try {
        const existing = await this.prisma.integrationSetting.findUnique({
          where: { integrationType: type },
        });

        if (!existing) {
          // Check for environment variables and create initial config
          const envConfig = this.getEnvConfig(type);
          const { publicSettings, secrets } = this.separateSecrets(type, envConfig);
          
          await this.prisma.integrationSetting.create({
            data: {
              integrationType: type,
              settings: publicSettings,
              encryptedCredentials: Object.keys(secrets).length > 0 
                ? this.encrypt(JSON.stringify(secrets)) 
                : null,
              isEnabled: this.hasValidEnvConfig(type, envConfig),
              isConfigured: this.hasValidEnvConfig(type, envConfig),
            },
          });
          
          this.logger.log(`Initialized ${type} integration from environment`);
        }
      } catch (error) {
        this.logger.warn(`Failed to initialize ${type} integration: ${error.message}`);
      }
    }
  }

  /**
   * Get configuration from environment variables
   */
  private getEnvConfig(type: string): Record<string, any> {
    switch (type) {
      case 'uccx':
        return {
          host: this.configService.get<string>('UCCX_HOST') || this.configService.get<string>('UCCX_NODES')?.split(',')[0] || '',
          port: parseInt(this.configService.get<string>('UCCX_PORT') || '8443'),
          username: this.configService.get<string>('UCCX_USERNAME') || '',
          password: this.configService.get<string>('UCCX_PASSWORD') || '',
          timeout: parseInt(this.configService.get<string>('UCCX_TIMEOUT_MS') || '30000'),
          allowSelfSigned: this.configService.get<string>('UCCX_ALLOW_SELF_SIGNED') === 'true',
        };
      case 'mediasense':
        return {
          apiUrl: this.configService.get<string>('MEDIASENSE_API_URL') || 
                  (this.configService.get<string>('MEDIASENSE_HOST') 
                    ? `https://${this.configService.get<string>('MEDIASENSE_HOST')}:${this.configService.get<string>('MEDIASENSE_PORT') || '8440'}`
                    : ''),
          apiKey: this.configService.get<string>('MEDIASENSE_API_KEY') || 
                  this.configService.get<string>('MEDIASENSE_USERNAME') || '',
          apiSecret: this.configService.get<string>('MEDIASENSE_API_SECRET') || 
                     this.configService.get<string>('MEDIASENSE_PASSWORD') || '',
          allowSelfSigned: this.configService.get<string>('MEDIASENSE_ALLOW_SELF_SIGNED') === 'true',
        };
      case 'opensearch':
        return {
          host: this.configService.get<string>('OPENSEARCH_HOST') || 'localhost',
          port: parseInt(this.configService.get<string>('OPENSEARCH_PORT') || '9200'),
          username: this.configService.get<string>('OPENSEARCH_USERNAME') || '',
          password: this.configService.get<string>('OPENSEARCH_PASSWORD') || '',
          indexPrefix: this.configService.get<string>('OPENSEARCH_INDEX_PREFIX') || 'qms',
          tls: this.configService.get<string>('OPENSEARCH_TLS') === 'true',
        };
      case 'email':
        return {
          smtpHost: this.configService.get<string>('SMTP_HOST') || '',
          smtpPort: parseInt(this.configService.get<string>('SMTP_PORT') || '587'),
          smtpUsername: this.configService.get<string>('SMTP_USERNAME') || '',
          smtpPassword: this.configService.get<string>('SMTP_PASSWORD') || '',
          fromAddress: this.configService.get<string>('SMTP_FROM_ADDRESS') || '',
          fromName: this.configService.get<string>('SMTP_FROM_NAME') || 'QMS',
          useTls: this.configService.get<string>('SMTP_USE_TLS') !== 'false',
        };
      case 'keycloak':
        return {
          realmUrl: this.configService.get<string>('KEYCLOAK_REALM_URL') || '',
          realm: this.configService.get<string>('KEYCLOAK_REALM') || 'master',
          clientId: this.configService.get<string>('KEYCLOAK_CLIENT_ID') || '',
          clientSecret: this.configService.get<string>('KEYCLOAK_CLIENT_SECRET') || '',
        };
      default:
        return {};
    }
  }

  /**
   * Check if environment config has required values
   */
  private hasValidEnvConfig(type: string, config: Record<string, any>): boolean {
    switch (type) {
      case 'mediasense':
        return !!(config.apiUrl && config.apiKey && config.apiSecret);
      case 'uccx':
        return !!(config.host && config.username && config.password);
      case 'opensearch':
        return !!(config.host);
      default:
        return false;
    }
  }

  /**
   * Separate secret fields from public settings
   */
  private separateSecrets(type: string, settings: Record<string, any>): { 
    publicSettings: Record<string, any>; 
    secrets: Record<string, any>;
  } {
    const fields = INTEGRATION_FIELDS[type] || [];
    const publicSettings: Record<string, any> = {};
    const secrets: Record<string, any> = {};

    for (const [key, value] of Object.entries(settings)) {
      const field = fields.find(f => f.key === key);
      if (field?.secret) {
        secrets[key] = value;
      } else {
        publicSettings[key] = value;
      }
    }

    return { publicSettings, secrets };
  }

  /**
   * Merge public settings with decrypted secrets
   */
  private mergeSettings(publicSettings: any, encryptedCredentials: string | null): Record<string, any> {
    const result = typeof publicSettings === 'object' ? { ...publicSettings } : {};
    
    if (encryptedCredentials) {
      try {
        const secrets = JSON.parse(this.decrypt(encryptedCredentials));
        Object.assign(result, secrets);
      } catch (e) {
        this.logger.warn('Failed to decrypt credentials');
      }
    }
    
    return result;
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.encryptionAlgorithm, this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Get integration configuration from database
   */
  async getIntegration(type: string): Promise<IntegrationConfig | null> {
    try {
      const record = await this.prisma.integrationSetting.findUnique({
        where: { integrationType: type },
      });

      if (!record) {
        return null;
      }

      const settings = this.mergeSettings(record.settings, record.encryptedCredentials);

      return {
        type: record.integrationType,
        settings,
        enabled: record.isEnabled,
        configured: record.isConfigured,
        lastTestAt: record.lastTestAt || undefined,
        lastTestSuccess: record.lastTestSuccess ?? undefined,
        lastTestError: record.lastTestError || undefined,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Failed to get integration ${type}:`, error.message);
      // Return env config as fallback
      const envConfig = this.getEnvConfig(type);
      return {
        type,
        settings: envConfig,
        enabled: false,
        configured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Update integration configuration in database
   */
  async updateIntegration(type: string, settings: Record<string, any>, userId?: string): Promise<IntegrationConfig> {
    const { publicSettings, secrets } = this.separateSecrets(type, settings);
    
    const data = {
      settings: publicSettings,
      encryptedCredentials: Object.keys(secrets).length > 0 ? this.encrypt(JSON.stringify(secrets)) : null,
      isConfigured: this.isConfigured(type, settings),
      updatedBy: userId,
    };

    const record = await this.prisma.integrationSetting.upsert({
      where: { integrationType: type },
      create: {
        integrationType: type,
        ...data,
        createdBy: userId,
      },
      update: data,
    });

    this.logger.log(`Updated ${type} integration settings`);

    return {
      type: record.integrationType,
      settings: this.mergeSettings(record.settings, record.encryptedCredentials),
      enabled: record.isEnabled,
      configured: record.isConfigured,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Enable/disable integration
   */
  async setIntegrationEnabled(type: string, enabled: boolean, userId?: string): Promise<void> {
    await this.prisma.integrationSetting.update({
      where: { integrationType: type },
      data: {
        isEnabled: enabled,
        updatedBy: userId,
      },
    });
    
    this.logger.log(`${type} integration ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if integration has all required fields
   */
  private isConfigured(type: string, settings: Record<string, any>): boolean {
    switch (type) {
      case 'mediasense':
        return !!(settings.apiUrl && settings.apiKey && settings.apiSecret);
      case 'uccx':
        return !!(settings.host && settings.username && settings.password);
      case 'opensearch':
        return !!(settings.host);
      case 'email':
        return !!(settings.smtpHost && settings.fromAddress);
      case 'keycloak':
        return !!(settings.realmUrl && settings.clientId);
      default:
        return false;
    }
  }

  /**
   * Get all integrations
   */
  async getAllIntegrations(): Promise<IntegrationConfig[]> {
    try {
      const records = await this.prisma.integrationSetting.findMany({
        orderBy: { integrationType: 'asc' },
      });

      return records.map(record => ({
        type: record.integrationType,
        settings: this.mergeSettings(record.settings, record.encryptedCredentials),
        enabled: record.isEnabled,
        configured: record.isConfigured,
        lastTestAt: record.lastTestAt || undefined,
        lastTestSuccess: record.lastTestSuccess ?? undefined,
        lastTestError: record.lastTestError || undefined,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }));
    } catch (error) {
      this.logger.error('Failed to get integrations:', error.message);
      return [];
    }
  }

  /**
   * Test integration connection
   */
  async testConnection(type: string): Promise<{ success: boolean; message: string; details?: any }> {
    const config = await this.getIntegration(type);
    if (!config) {
      return { success: false, message: 'Integration not configured' };
    }

    let result: { success: boolean; message: string; details?: any };

    switch (type) {
      case 'uccx':
        result = await this.testUccxConnection(config.settings);
        break;
      case 'mediasense':
        result = await this.testMediaSenseConnection(config.settings);
        break;
      case 'opensearch':
        result = await this.testOpenSearchConnection(config.settings);
        break;
      case 'email':
        result = await this.testEmailConnection(config.settings);
        break;
      case 'keycloak':
        result = await this.testKeycloakConnection(config.settings);
        break;
      default:
        result = { success: false, message: 'Unknown integration type' };
    }

    // Update test result in database
    try {
      await this.prisma.integrationSetting.update({
        where: { integrationType: type },
        data: {
          lastTestAt: new Date(),
          lastTestSuccess: result.success,
          lastTestError: result.success ? null : result.message,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to update test result for ${type}`);
    }

    return result;
  }

  /**
   * Test UCCX connection
   */
  private async testUccxConnection(settings: any): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      if (!settings.host || !settings.username || !settings.password) {
        return { success: false, message: 'Missing required UCCX settings (host, username, password)' };
      }

      const url = `https://${settings.host}:${settings.port || 8443}/adminapi/version`;
      
      const response = await axios.get(url, {
        auth: {
          username: settings.username,
          password: settings.password,
        },
        timeout: settings.timeout || 30000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: !settings.allowSelfSigned,
        }),
        validateStatus: () => true,
      });

      if (response.status === 200) {
        return { 
          success: true, 
          message: 'UCCX connection successful',
          details: { version: response.data },
        };
      } else if (response.status === 401) {
        return { success: false, message: 'Authentication failed - check username/password' };
      } else {
        return { success: false, message: `UCCX returned status ${response.status}` };
      }
    } catch (error: any) {
      const message = error.code === 'ECONNREFUSED' 
        ? 'Connection refused - check host and port'
        : error.code === 'ENOTFOUND'
        ? 'Host not found - check hostname'
        : error.code === 'ETIMEDOUT'
        ? 'Connection timeout'
        : `Connection failed: ${error.message}`;
      return { success: false, message };
    }
  }

  /**
   * Test MediaSense connection
   */
  private async testMediaSenseConnection(settings: any): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      if (!settings.apiUrl || !settings.apiKey || !settings.apiSecret) {
        return { success: false, message: 'Missing required MediaSense settings (apiUrl, apiKey, apiSecret)' };
      }

      // Clean up API URL
      let apiUrl = settings.apiUrl.replace(/\/$/, '');
      
      // MediaSense uses Basic Auth with username:password
      const url = `${apiUrl}/ora/sessionquery`;
      
      this.logger.debug(`Testing MediaSense connection to: ${url}`);

      const response = await axios.get(url, {
        auth: {
          username: settings.apiKey,
          password: settings.apiSecret,
        },
        timeout: 30000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: !settings.allowSelfSigned,
        }),
        validateStatus: () => true,
        params: {
          limit: 1,
          offset: 0,
        },
      });

      this.logger.debug(`MediaSense response status: ${response.status}`);

      if (response.status === 200) {
        return { 
          success: true, 
          message: 'MediaSense connection successful',
          details: { 
            apiVersion: response.headers['x-mediasense-api-version'] || 'unknown',
            totalRecords: response.data?.count || response.data?.totalCount || 0,
          },
        };
      } else if (response.status === 401) {
        return { success: false, message: 'Authentication failed - check API key and secret' };
      } else if (response.status === 403) {
        return { success: false, message: 'Access forbidden - check API permissions' };
      } else if (response.status === 404) {
        // Try alternative endpoint
        const altUrl = `${apiUrl}/ora/info`;
        const altResponse = await axios.get(altUrl, {
          auth: { username: settings.apiKey, password: settings.apiSecret },
          timeout: 30000,
          httpsAgent: new https.Agent({ rejectUnauthorized: !settings.allowSelfSigned }),
          validateStatus: () => true,
        });
        
        if (altResponse.status === 200) {
          return { success: true, message: 'MediaSense connection successful (info endpoint)' };
        }
        return { success: false, message: 'MediaSense API endpoint not found - check API URL' };
      } else {
        return { success: false, message: `MediaSense returned status ${response.status}: ${response.statusText}` };
      }
    } catch (error: any) {
      this.logger.error('MediaSense connection test failed:', error.message);
      
      const message = error.code === 'ECONNREFUSED' 
        ? 'Connection refused - check host and port'
        : error.code === 'ENOTFOUND'
        ? 'Host not found - check API URL'
        : error.code === 'ETIMEDOUT'
        ? 'Connection timeout'
        : error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'CERT_HAS_EXPIRED'
        ? 'SSL certificate error - enable "Allow Self-Signed Certificates" option'
        : `Connection failed: ${error.message}`;
      return { success: false, message };
    }
  }

  /**
   * Test OpenSearch connection
   */
  private async testOpenSearchConnection(settings: any): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      if (!settings.host) {
        return { success: false, message: 'Missing required OpenSearch host' };
      }

      const protocol = settings.tls ? 'https' : 'http';
      const url = `${protocol}://${settings.host}:${settings.port || 9200}/_cluster/health`;
      
      const response = await axios.get(url, {
        auth: settings.username ? {
          username: settings.username,
          password: settings.password || '',
        } : undefined,
        timeout: 10000,
        httpsAgent: new https.Agent({
          rejectUnauthorized: false, // OpenSearch often uses self-signed certs
        }),
        validateStatus: () => true,
      });

      if (response.status === 200) {
        return { 
          success: true, 
          message: 'OpenSearch connection successful',
          details: {
            clusterName: response.data.cluster_name,
            status: response.data.status,
            numberOfNodes: response.data.number_of_nodes,
          },
        };
      } else if (response.status === 401) {
        return { success: false, message: 'Authentication failed - check credentials' };
      } else {
        return { success: false, message: `OpenSearch returned status ${response.status}` };
      }
    } catch (error: any) {
      const message = error.code === 'ECONNREFUSED' 
        ? 'Connection refused - check host and port'
        : `Connection failed: ${error.message}`;
      return { success: false, message };
    }
  }

  /**
   * Test Email connection
   */
  private async testEmailConnection(settings: any): Promise<{ success: boolean; message: string }> {
    try {
      if (!settings.smtpHost) {
        return { success: false, message: 'Missing required SMTP host' };
      }

      // For now, just validate settings are present
      return { success: true, message: 'Email settings validated (connection test not implemented)' };
    } catch (error: any) {
      return { success: false, message: `Email connection failed: ${error.message}` };
    }
  }

  /**
   * Test Keycloak connection
   */
  private async testKeycloakConnection(settings: any): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      if (!settings.realmUrl) {
        return { success: false, message: 'Missing required Keycloak realm URL' };
      }

      const url = `${settings.realmUrl}/.well-known/openid-configuration`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        validateStatus: () => true,
      });

      if (response.status === 200) {
        return { 
          success: true, 
          message: 'Keycloak connection successful',
          details: {
            issuer: response.data.issuer,
            tokenEndpoint: response.data.token_endpoint,
          },
        };
      } else {
        return { success: false, message: `Keycloak returned status ${response.status}` };
      }
    } catch (error: any) {
      return { success: false, message: `Keycloak connection failed: ${error.message}` };
    }
  }

  /**
   * Get field definitions for integration type
   */
  getIntegrationFields(type: string): { key: string; secret: boolean; label: string }[] {
    return INTEGRATION_FIELDS[type] || [];
  }
}
