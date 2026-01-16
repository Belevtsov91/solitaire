import sharp from "sharp";
import fs from "fs";
import path from "path";

const cardsDir = path.resolve("public/assets/cards");
const optimizedDir = path.resolve("public/assets/cards-optimized");

if (!fs.existsSync(cardsDir)) {
  console.error("❌ Папка с картами не найдена:", cardsDir);
  process.exit(1);
}

if (!fs.existsSync(optimizedDir)) {
  fs.mkdirSync(optimizedDir, { recursive: true });
}

const files = fs.readdirSync(cardsDir).filter((f) => f.endsWith(".png"));

console.log(`🔧 Оптимизация ${files.length} карт...`);

for (const file of files) {
  const input = path.join(cardsDir, file);
  const output = path.join(optimizedDir, file);

  await sharp(input)
    .resize(200, 300)
    .png({ quality: 80, compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  console.log(`✅ ${file} оптимизирован`);
}

fs.rmSync(cardsDir, { recursive: true, force: true });
fs.renameSync(optimizedDir, cardsDir);

console.log("🎯 Все карты уменьшены до 200×300 и оптимизированы!");
