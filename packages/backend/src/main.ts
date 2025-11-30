import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend communication
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000', // Vite default port
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3100);
}
bootstrap();
