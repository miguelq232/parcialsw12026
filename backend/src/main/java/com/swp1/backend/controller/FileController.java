package com.swp1.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = "*")
public class FileController {

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    @Value("${app.storage.provider:local}")
    private String storageProvider;

    @Value("${app.s3.bucket:}")
    private String s3Bucket;

    @Value("${app.s3.region:us-east-1}")
    private String s3Region;

    @Value("${app.s3.endpoint:}")
    private String s3Endpoint;

    @Value("${app.s3.access-key:}")
    private String s3AccessKey;

    @Value("${app.s3.secret-key:}")
    private String s3SecretKey;

    @Value("${app.s3.path-prefix:tramites}")
    private String s3PathPrefix;

    private S3Client s3Client;

    @PostMapping("/upload")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "El archivo esta vacio."));
        }

        try {
            String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "archivo";
            String safeName = originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
            String storedName = UUID.randomUUID() + "-" + safeName;

            if (isS3Storage()) {
                uploadToS3(file, storedName);
            } else {
                Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
                Files.createDirectories(root);
                Path target = root.resolve(storedName).normalize();

                if (!target.startsWith(root)) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Nombre de archivo invalido."));
                }

                Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            }

            return ResponseEntity.ok(Map.of(
                    "archivoNombre", originalName,
                    "archivoTipo", file.getContentType() != null ? file.getContentType() : "application/octet-stream",
                    "archivoUrl", "/api/files/" + storedName,
                    "size", file.getSize()
            ));
        } catch (S3Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "No se pudo guardar el archivo en S3: " + e.awsErrorDetails().errorMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "No se pudo guardar el archivo: " + e.getMessage()));
        }
    }

    @GetMapping("/{fileName:.+}")
    public ResponseEntity<?> download(@PathVariable String fileName) throws IOException {
        if (isS3Storage()) {
            return downloadFromS3(fileName);
        }

        Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path file = root.resolve(fileName).normalize();

        if (!file.startsWith(root) || !Files.exists(file)) {
            return ResponseEntity.notFound().build();
        }

        org.springframework.core.io.Resource resource = new org.springframework.core.io.UrlResource(file.toUri());
        String contentType = Files.probeContentType(file);
        MediaType mediaType = contentType != null
                ? MediaType.parseMediaType(contentType)
                : MediaType.APPLICATION_OCTET_STREAM;

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header("Content-Disposition", "inline; filename=\"" + file.getFileName() + "\"")
                .body(resource);
    }

    private boolean isS3Storage() {
        return "s3".equalsIgnoreCase(storageProvider);
    }

    private void uploadToS3(MultipartFile file, String storedName) throws IOException {
        validateS3Config();
        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(s3Bucket)
                .key(s3Key(storedName))
                .contentType(contentType)
                .contentLength(file.getSize())
                .metadata(Map.of("original-filename", file.getOriginalFilename() != null ? file.getOriginalFilename() : storedName))
                .build();

        getS3Client().putObject(request, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
    }

    private ResponseEntity<?> downloadFromS3(String fileName) {
        validateS3Config();
        try {
            ResponseBytes<GetObjectResponse> object = getS3Client().getObjectAsBytes(GetObjectRequest.builder()
                    .bucket(s3Bucket)
                    .key(s3Key(fileName))
                    .build());

            String contentType = object.response().contentType() != null
                    ? object.response().contentType()
                    : "application/octet-stream";

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header("Content-Disposition", "inline; filename=\"" + fileName + "\"")
                    .body(object.asByteArray());
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.internalServerError().body(Map.of("error", "No se pudo leer el archivo desde S3: " + e.awsErrorDetails().errorMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    private String s3Key(String fileName) {
        String prefix = s3PathPrefix == null ? "" : s3PathPrefix.trim().replaceAll("^/+", "").replaceAll("/+$", "");
        return prefix.isBlank() ? fileName : prefix + "/" + fileName;
    }

    private void validateS3Config() {
        if (s3Bucket == null || s3Bucket.isBlank()) {
            throw new IllegalStateException("AWS_S3_BUCKET no esta configurado.");
        }
    }

    private S3Client getS3Client() {
        if (s3Client != null) {
            return s3Client;
        }

        var builder = S3Client.builder().region(Region.of(s3Region));

        if (s3AccessKey != null && !s3AccessKey.isBlank() && s3SecretKey != null && !s3SecretKey.isBlank()) {
            builder.credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(s3AccessKey, s3SecretKey)));
        }

        if (s3Endpoint != null && !s3Endpoint.isBlank()) {
            builder.endpointOverride(URI.create(s3Endpoint));
            builder.serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
        }

        s3Client = builder.build();
        return s3Client;
    }
}
