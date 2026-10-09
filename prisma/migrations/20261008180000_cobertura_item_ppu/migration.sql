-- Cobertura: Item da PPU (base de medição Petrobras)
ALTER TABLE "cobertura" ADD COLUMN "item_ppu" TEXT;
ALTER TABLE "cobertura"
  ADD CONSTRAINT "cobertura_item_ppu_fkey"
  FOREIGN KEY ("item_ppu") REFERENCES "item_ppu"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;
