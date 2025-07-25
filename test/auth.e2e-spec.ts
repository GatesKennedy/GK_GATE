import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/auth/register (POST)', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPassword123!',
          confirmPassword: 'TestPassword123!',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toBe('Registration successful');
          expect(res.body.user).toBeDefined();
          expect(res.body.tokens).toBeDefined();
          expect(res.body.tokens.accessToken).toBeDefined();
          expect(res.body.tokens.refreshToken).toBeDefined();
        });
    });

    it('should reject weak password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'weak',
          confirmPassword: 'weak',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Validation failed');
          expect(res.body.errors).toBeDefined();
        });
    });

    it('should reject mismatched passwords', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'TestPassword123!',
          confirmPassword: 'DifferentPassword123!',
        })
        .expect(400);
    });
  });

  describe('/api/v1/auth/login (POST)', () => {
    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123!',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Login successful');
          expect(res.body.user).toBeDefined();
          expect(res.body.tokens).toBeDefined();
        });
    });

    it('should reject invalid username format', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'us',
          password: 'TestPassword123!',
        })
        .expect(400);
    });
  });

  describe('/api/v1/auth/profile (GET)', () => {
    let accessToken: string;

    beforeAll(async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123!',
        });

      accessToken = loginResponse.body.tokens.accessToken;
    });

    it('should get user profile with valid token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Profile retrieved successfully');
          expect(res.body.user).toBeDefined();
          expect(res.body.user.username).toBe('testuser');
        });
    });

    it('should reject request without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .expect(401);
    });

    it('should reject request with invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('/api/v1/auth/admin-only (GET)', () => {
    let userToken: string;

    beforeAll(async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123!',
        });

      userToken = loginResponse.body.tokens.accessToken;
    });

    it('should reject regular user access to admin endpoint', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/admin-only')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toContain('Access denied');
        });
    });
  });
});