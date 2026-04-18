/**
 * Script para gerar ícones PNG do PWA a partir do SVG
 * 
 * Como usar:
 * 1. Instale as dependências: npm install sharp
 * 2. Execute: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Verifica se sharp está instalado
try {
  const sharp = require('sharp');
  
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  const svgPath = path.join(__dirname, 'icon.svg');
  
  if (!fs.existsSync(svgPath)) {
    console.error('Arquivo icon.svg não encontrado!');
    process.exit(1);
  }
  
  const svgBuffer = fs.readFileSync(svgPath);
  
  async function generateIcons() {
    for (const size of sizes) {
      const outputPath = path.join(__dirname, `icon-${size}x${size}.png`);
      
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Gerado: icon-${size}x${size}.png`);
    }
    console.log('\n✅ Todos os ícones foram gerados com sucesso!');
  }
  
  generateIcons().catch(err => {
    console.error('Erro ao gerar ícones:', err);
    process.exit(1);
  });
  
} catch (err) {
  console.log(`
⚠️  O pacote 'sharp' não está instalado.

Para gerar os ícones PNG, execute:

  cd client/public
  npm init -y
  npm install sharp
  node generate-icons.js

Ou use uma ferramenta online como:
- https://convertio.co/svg-png/
- https://cloudconvert.com/svg-to-png

Tamanhos necessários: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
`);
}
