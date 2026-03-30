import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import fs from 'fs';
import { Application } from 'express';

/**
 * Swagger middleware to serve ERP API documentation
 * @param app Express application instance
 */
export const setupSwagger = (app: Application): void => {
  try {
    const swaggerPath = path.join(__dirname, '../../swagger.yaml');
    let swaggerDocument;
    
    // Check if file exists
    if (!fs.existsSync(swaggerPath)) {
      throw new Error(`Swagger file not found at: ${swaggerPath}`);
    }
    
    // Read file content
    const fileContent = fs.readFileSync(swaggerPath, 'utf8');
    
    // Try to parse as JSON first, then as YAML
    try {
      swaggerDocument = JSON.parse(fileContent);
      console.log('📄 Loaded Swagger documentation from JSON format');
    } catch (jsonError) {
      try {
        swaggerDocument = YAML.parse(fileContent);
        console.log('📄 Loaded Swagger documentation from YAML format');
      } catch (yamlError) {
        throw new Error(`Invalid Swagger file format. Must be valid JSON or YAML.`);
      }
    }
    
    // Serve Swagger UI
    app.use('/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerDocument, {
        explorer: true,
        customCss: `
          .swagger-ui .topbar { display: none }
          .swagger-ui .info .title { color: #2c3e50; font-size: 2em; }
          .swagger-ui .scheme-container { background: #f8f9fa; padding: 20px; border-radius: 5px; }
          .swagger-ui .info .description { font-size: 1.1em; line-height: 1.6; }
          .swagger-ui .opblock-summary-description { font-weight: normal; }
          .swagger-ui .opblock { margin-bottom: 10px; }
        `,
        customSiteTitle: 'ERP System API Documentation',
        customfavIcon: '/favicon.ico',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          showExtensions: true,
          showCommonExtensions: true,
          docExpansion: 'list',
          defaultModelsExpandDepth: 2,
          defaultModelExpandDepth: 2,
          displayOperationId: false,
          tryItOutEnabled: true
        }
      })
    );

    // JSON endpoint for raw swagger spec
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerDocument);
    });

    const pathCount = Object.keys(swaggerDocument.paths || {}).length;
    const definitionCount = Object.keys(swaggerDocument.definitions || swaggerDocument.components?.schemas || {}).length;

    console.log('📚 ERP API Documentation loaded successfully!');
    console.log(`📊 Total Endpoints: ${pathCount}`);
    console.log(`📋 Data Models: ${definitionCount}`);
    console.log('🌐 Swagger UI: http://localhost:5000/api-docs');
    console.log('📄 JSON Spec: http://localhost:5000/api-docs.json');
    
  } catch (error) {
    console.error('❌ Error setting up Swagger documentation:', error);
    console.log('💡 Make sure swagger.yaml exists and is valid JSON or YAML format');
  }
};