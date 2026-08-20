import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

async function generate() {
  // Bootstrap NestJS app context dynamically without starting HTTP listener
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Aurora API')
    .setDescription('Aurora E-Commerce API Endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // Save to the root of backend
  const outputPath = path.join(__dirname, '../swagger.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');
  console.log(`✅ Swagger JSON generated successfully at: ${outputPath}`);

  await app.close();
}

generate().catch((err) => {
  console.error('❌ Failed to generate Swagger JSON:', err);
  process.exit(1);
});
