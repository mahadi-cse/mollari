import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSiteSettings() {
  console.log('🌐 Seeding site settings...');

  try {
    // Check if settings already exist
    const existing = await prisma.siteSettings.findFirst();

    if (existing) {
      console.log('✓ Site settings already exist. Updating...');
      await prisma.siteSettings.update({
        where: { id: 1 },
        data: {
          storeName: 'Mollari',
          tagline: 'Clean · Cruelty-Free · Bangladesh',
          heroHeadline: 'Spring Beauty Collection',
          heroYear: '2026',
          heroDescription: 'Discover luxurious skincare and makeup that celebrates your natural glow. Clean, cruelty-free formulas delivered across Bangladesh in 48 hours.',
        },
      });
    } else {
      console.log('✓ Creating site settings...');
      await prisma.siteSettings.create({
        data: {
          storeName: 'Mollari',
          tagline: 'Clean · Cruelty-Free · Bangladesh',
          heroHeadline: 'Spring Beauty Collection',
          heroYear: '2026',
          heroDescription: 'Discover luxurious skincare and makeup that celebrates your natural glow. Clean, cruelty-free formulas delivered across Bangladesh in 48 hours.',
        },
      });
    }

    const settings = await prisma.siteSettings.findFirst();
    console.log('✓ Site settings created/updated:', settings);
    console.log('✨ Site settings seed completed!');
  } catch (error) {
    console.error('✗ Error seeding site settings:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedSiteSettings();
