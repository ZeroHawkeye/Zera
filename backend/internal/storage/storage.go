// Package storage 提供对象存储服务
// 使用 S3 兼容协议连接 RustFS
package storage

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"time"

	"zera/internal/config"
	"zera/internal/logger"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Storage 对象存储客户端
type Storage struct {
	client *s3.Client
	config *config.StorageConfig
	logger *slog.Logger
}

// New 创建存储客户端实例
func New(cfg *config.StorageConfig, slogger *slog.Logger) (*Storage, error) {
	if !cfg.Enabled {
		logger.Info("storage service is disabled")
		return &Storage{
			config: cfg,
			logger: slogger,
		}, nil
	}

	// 创建自定义凭证提供者
	credProvider := credentials.NewStaticCredentialsProvider(
		cfg.AccessKey,
		cfg.SecretKey,
		"",
	)

	// 创建自定义端点解析器
	customResolver := aws.EndpointResolverWithOptionsFunc(
		func(service, region string, options ...interface{}) (aws.Endpoint, error) {
			return aws.Endpoint{
				URL:               cfg.Endpoint,
				HostnameImmutable: true,
				SigningRegion:     cfg.Region,
			}, nil
		},
	)

	// 加载 AWS 配置
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithRegion(cfg.Region),
		awsconfig.WithCredentialsProvider(credProvider),
		awsconfig.WithEndpointResolverWithOptions(customResolver),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// 创建 S3 客户端
	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = cfg.UsePathStyle
	})

	storage := &Storage{
		client: client,
		config: cfg,
		logger: slogger,
	}

	// 验证连接
	if err := storage.ping(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to connect to storage: %w", err)
	}

	logger.Info("storage service connected",
		"endpoint", cfg.Endpoint,
		"bucket", cfg.Bucket,
	)

	return storage, nil
}

// ping 测试存储连接
func (s *Storage) ping(ctx context.Context) error {
	if s.client == nil {
		return nil
	}

	_, err := s.client.ListBuckets(ctx, &s3.ListBucketsInput{})
	return err
}

// IsEnabled 检查存储服务是否启用
func (s *Storage) IsEnabled() bool {
	return s.config.Enabled && s.client != nil
}

// Client 返回原始 S3 客户端（用于高级操作）
func (s *Storage) Client() *s3.Client {
	return s.client
}

// Config 返回存储配置
func (s *Storage) Config() *config.StorageConfig {
	return s.config
}

// EnsureBucket 确保默认存储桶存在
func (s *Storage) EnsureBucket(ctx context.Context) error {
	if !s.IsEnabled() {
		return nil
	}

	bucket := s.config.Bucket
	if bucket == "" {
		return fmt.Errorf("bucket name is empty")
	}

	// 检查桶是否存在
	_, err := s.client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(bucket),
	})
	if err == nil {
		s.logger.Debug("Bucket already exists", "bucket", bucket)
		return nil
	}

	// 创建桶
	_, err = s.client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(bucket),
	})
	if err != nil {
		return fmt.Errorf("failed to create bucket %s: %w", bucket, err)
	}

	s.logger.Info("Bucket created", "bucket", bucket)
	return nil
}

// UploadObject 上传对象
func (s *Storage) UploadObject(ctx context.Context, key string, body io.Reader, contentType string) error {
	if !s.IsEnabled() {
		return fmt.Errorf("storage service is not enabled")
	}

	input := &s3.PutObjectInput{
		Bucket: aws.String(s.config.Bucket),
		Key:    aws.String(key),
		Body:   body,
	}

	if contentType != "" {
		input.ContentType = aws.String(contentType)
	}

	_, err := s.client.PutObject(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to upload object %s: %w", key, err)
	}

	s.logger.Debug("Object uploaded", "key", key)
	return nil
}

// DownloadObject 下载对象
func (s *Storage) DownloadObject(ctx context.Context, key string) (io.ReadCloser, error) {
	if !s.IsEnabled() {
		return nil, fmt.Errorf("storage service is not enabled")
	}

	output, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.config.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to download object %s: %w", key, err)
	}

	return output.Body, nil
}

// DeleteObject 删除对象
func (s *Storage) DeleteObject(ctx context.Context, key string) error {
	if !s.IsEnabled() {
		return fmt.Errorf("storage service is not enabled")
	}

	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.config.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete object %s: %w", key, err)
	}

	s.logger.Debug("Object deleted", "key", key)
	return nil
}

// GetObjectURL 获取对象的访问 URL
func (s *Storage) GetObjectURL(key string) string {
	if !s.IsEnabled() {
		return ""
	}

	return fmt.Sprintf("%s/%s/%s", s.config.Endpoint, s.config.Bucket, key)
}

// GetPresignedURL 获取预签名 URL（用于临时访问私有对象）
func (s *Storage) GetPresignedURL(ctx context.Context, key string, expiry time.Duration) (string, error) {
	if !s.IsEnabled() {
		return "", fmt.Errorf("storage service is not enabled")
	}

	presignClient := s3.NewPresignClient(s.client)

	request, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.config.Bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", fmt.Errorf("failed to create presigned URL for %s: %w", key, err)
	}

	return request.URL, nil
}

// ListObjects 列出对象
func (s *Storage) ListObjects(ctx context.Context, prefix string, maxKeys int32) ([]ObjectInfo, error) {
	if !s.IsEnabled() {
		return nil, fmt.Errorf("storage service is not enabled")
	}

	input := &s3.ListObjectsV2Input{
		Bucket: aws.String(s.config.Bucket),
	}

	if prefix != "" {
		input.Prefix = aws.String(prefix)
	}

	if maxKeys > 0 {
		input.MaxKeys = aws.Int32(maxKeys)
	}

	output, err := s.client.ListObjectsV2(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to list objects: %w", err)
	}

	objects := make([]ObjectInfo, 0, len(output.Contents))
	for _, obj := range output.Contents {
		objects = append(objects, ObjectInfo{
			Key:          aws.ToString(obj.Key),
			Size:         aws.ToInt64(obj.Size),
			LastModified: aws.ToTime(obj.LastModified),
			ETag:         aws.ToString(obj.ETag),
		})
	}

	return objects, nil
}

// ObjectInfo 对象信息
type ObjectInfo struct {
	Key          string
	Size         int64
	LastModified time.Time
	ETag         string
}

// Close 关闭存储客户端
func (s *Storage) Close() error {
	// S3 客户端不需要显式关闭
	logger.Info("storage service closed")
	return nil
}
