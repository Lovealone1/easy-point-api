import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfig } from '../../common/config/config.js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const appConfig = this.configService.get<AppConfig['s3']>('app.s3');
    if (!appConfig) {
      throw new Error('S3 configuration is missing');
    }

    this.bucketName = appConfig.bucketName;

    this.s3Client = new S3Client({
      endpoint: appConfig.endpoint,
      region: appConfig.region,
      credentials: {
        accessKeyId: appConfig.accessKeyId,
        secretAccessKey: appConfig.secretAccessKey,
      },
      // Required for Supabase S3 compatibility and many other S3-compatible services
      forcePathStyle: true,
    });
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimetype: string,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimetype,
      });

      await this.s3Client.send(command);
      this.logger.log(
        `File ${fileName} uploaded successfully to ${this.bucketName}`,
      );
      return fileName;
    } catch (error) {
      this.logger.error(`Error uploading file ${fileName}`, error);
      throw error;
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });

      await this.s3Client.send(command);
      this.logger.log(
        `File ${fileName} deleted successfully from ${this.bucketName}`,
      );
    } catch (error) {
      this.logger.error(`Error deleting file ${fileName}`, error);
      throw error;
    }
  }

  async getPresignedUrl(
    fileName: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });
      return url;
    } catch (error) {
      this.logger.error(
        `Error generating presigned URL for ${fileName}`,
        error,
      );
      throw error;
    }
  }
}
