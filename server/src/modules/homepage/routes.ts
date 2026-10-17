import { Router } from "express";
import { prisma } from "../../config/database";
import { cacheGet, cacheSet, cacheDel, TTL } from "../../shared/utils/cache";
import { authenticate, authorize } from "../../middleware/authenticate";
import { USER_TYPE_CODES } from "../../shared/types/auth.types";
import { parsePagination } from "../../shared/utils/pagination";
import { AuditLogger } from "../../shared/utils/auditLogger";

const router = Router();

// Cache key constants
const HP_KEYS = {
  stats: 'homepage:stats',
  settings: 'homepage:settings',
  slider: 'homepage:slider',
  state: 'homepage:state',
};


/**
 * GET /api/homepage/stats
 * Fetch homepage statistics for the hero section
 */
router.get("/stats", async (req, res) => {
  try {
    const cached = await cacheGet<any>(HP_KEYS.stats);
    if (cached) return res.json(cached);

    const stats = await prisma.homepageStats.findFirst();
    const paymentMethods = await prisma.paymentMethodOption.findMany({
      orderBy: { createdAt: "asc" }
    });

    const result = stats
      ? { ...stats, paymentMethods }
      : {
          totalHappyCustomers: 10000,
          minFreeDeliveryAmount: 999,
          isFreeDeliveryActive: true,
          deliveryTimeframe: "48hr",
          currentOfferText: "Spring Sale - Save up to 40%",
          currentOfferPercentage: 40,
          isOfferActive: true,
          paymentMethods,
        };

    await cacheSet(HP_KEYS.stats, result, TTL.MEDIUM);
    return res.json(result);
  } catch (error) {
    console.error("Error fetching homepage stats:", error);
    res.status(500).json({ error: "Failed to fetch homepage stats" });
  }
});

/**
 * GET /api/homepage/state
 * Alias for /api/homepage/stats to support general app state fetching
 */
router.get("/state", async (req, res) => {
  try {
    const cached = await cacheGet<any>(HP_KEYS.state);
    if (cached) return res.json(cached);

    const stats = await prisma.homepageStats.findFirst();
    const settings = await prisma.siteSettings.findFirst();
    const paymentMethods = await prisma.paymentMethodOption.findMany({
      orderBy: { createdAt: "asc" }
    });

    const result = { ...stats, settings, paymentMethods };
    await cacheSet(HP_KEYS.state, result, TTL.MEDIUM);
    return res.json(result);
  } catch (error) {
    console.error("Error fetching global state:", error);
    res.status(500).json({ error: "Failed to fetch global state" });
  }
});

/**
 * PUT /api/homepage/stats
 * Update homepage statistics (Admin only)
 */
router.put("/stats", authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER), async (req, res) => {
  try {
    const {
      totalHappyCustomers,
      minFreeDeliveryAmount,
      isFreeDeliveryActive,
      deliveryTimeframe,
      currentOfferText,
      currentOfferPercentage,
      isOfferActive
    } = req.body;

    const beforeState = await prisma.homepageStats.findFirst();

    const stats = await prisma.homepageStats.upsert({
      where: { id: 1 },
      update: {
        ...(totalHappyCustomers !== undefined && { totalHappyCustomers }),
        ...(minFreeDeliveryAmount !== undefined && { minFreeDeliveryAmount }),
        ...(isFreeDeliveryActive !== undefined && { isFreeDeliveryActive }),
        ...(deliveryTimeframe !== undefined && { deliveryTimeframe }),
        ...(currentOfferText !== undefined && { currentOfferText }),
        ...(currentOfferPercentage !== undefined && { currentOfferPercentage }),
        ...(isOfferActive !== undefined && { isOfferActive }),
      },
      create: {
        id: 1,
        totalHappyCustomers: totalHappyCustomers || 10000,
        minFreeDeliveryAmount: minFreeDeliveryAmount || 999,
        isFreeDeliveryActive: isFreeDeliveryActive !== undefined ? isFreeDeliveryActive : true,
        deliveryTimeframe: deliveryTimeframe || "48hr",
        currentOfferText: currentOfferText || "Spring Sale - Save up to 40%",
        currentOfferPercentage: currentOfferPercentage || 40,
        isOfferActive: isOfferActive !== undefined ? isOfferActive : true,
      },
    });

    await AuditLogger.log({
      req,
      action: beforeState ? 'UPDATE' : 'CREATE',
      entity: 'HomepageStats',
      entityId: '1',
      entityLabel: 'Homepage Statistics & Shipping Rules',
      before: beforeState,
      after: stats,
    });

    // Bust both stats and state caches
    await cacheDel(HP_KEYS.stats, HP_KEYS.state);
    res.json({ message: "Stats updated successfully", data: stats });
  } catch (error) {
    console.error("Error updating homepage stats:", error);
    res.status(500).json({ error: "Failed to update homepage stats" });
  }
});

/**
 * POST /api/homepage/payment-methods
 * Create a new payment method option
 */
router.post("/payment-methods", authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const method = await prisma.paymentMethodOption.create({ data: { name } });

    await AuditLogger.log({
      req,
      action: 'CREATE',
      entity: 'PaymentMethodOption',
      entityId: String(method.id),
      entityLabel: `Payment Method: ${method.name}`,
      after: method,
    });

    await cacheDel(HP_KEYS.stats, HP_KEYS.state);
    res.status(201).json(method);
  } catch (error) {
    console.error("Error creating payment method:", error);
    res.status(500).json({ error: "Failed to create payment method" });
  }
});

/**
 * PATCH /api/homepage/payment-methods/:id
 * Toggle active status or update name
 */
router.patch("/payment-methods/:id", authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;

    const beforeState = await prisma.paymentMethodOption.findUnique({
      where: { id: parseInt(id) }
    });

    const method = await prisma.paymentMethodOption.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive })
      }
    });

    await AuditLogger.log({
      req,
      action: (isActive !== undefined && Object.keys(req.body).length === 1) ? 'TOGGLE' : 'UPDATE',
      entity: 'PaymentMethodOption',
      entityId: id,
      entityLabel: `Payment Method: ${method.name}`,
      before: beforeState,
      after: method,
    });

    await cacheDel(HP_KEYS.stats, HP_KEYS.state);
    res.json(method);
  } catch (error) {
    console.error("Error updating payment method:", error);
    res.status(500).json({ error: "Failed to update payment method" });
  }
});

/**
 * DELETE /api/homepage/payment-methods/:id
 * Delete a payment method option
 */
router.delete("/payment-methods/:id", authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER), async (req, res) => {
  try {
    const { id } = req.params;

    const beforeState = await prisma.paymentMethodOption.findUnique({
      where: { id: parseInt(id) }
    });

    await prisma.paymentMethodOption.delete({ where: { id: parseInt(id) } });

    await AuditLogger.log({
      req,
      action: 'DELETE',
      entity: 'PaymentMethodOption',
      entityId: id,
      entityLabel: beforeState ? `Payment Method: ${beforeState.name}` : undefined,
      before: beforeState,
    });

    await cacheDel(HP_KEYS.stats, HP_KEYS.state);
    res.json({ message: "Payment method deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment method:", error);
    res.status(500).json({ error: "Failed to delete payment method" });
  }
});

/**
 * GET /api/homepage/settings
 * Fetch site settings (store name, hero heading, etc)
 */
router.get("/settings", async (req, res) => {
  try {
    const cached = await cacheGet<any>(HP_KEYS.settings);
    if (cached) return res.json(cached);

    const settings = await prisma.siteSettings.findFirst();

    const result = settings ?? {
      storeName: "Mollari",
      tagline: "Clean · Cruelty-Free · Bangladesh",
      primaryColor: "#f01172",
      heroHeadline: "Spring Beauty Collection",
      heroYear: "2026",
      heroDescription: "Discover luxurious skincare and makeup that celebrates your natural glow. Clean, cruelty-free formulas delivered across Bangladesh in 48 hours.",
      contactAddress: "Dhaka, Bangladesh",
      contactPhone: "+880 1XXX-XXXXXX",
      contactEmail: "hello@mollari.com",
    };

    await cacheSet(HP_KEYS.settings, result, TTL.MEDIUM);
    return res.json(result);
  } catch (error) {
    console.error("Error fetching site settings:", error);
    res.status(500).json({ error: "Failed to fetch site settings" });
  }
});

/**
 * PUT /api/homepage/settings
 * Update site settings (Admin only)
 */
router.put("/settings", authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER), async (req, res) => {
  try {
    const {
      storeName, tagline, primaryColor, heroHeadline, heroYear, heroDescription,
      contactAddress, contactPhone, contactEmail
    } = req.body;

    const beforeState = await prisma.siteSettings.findFirst();

    const settings = await prisma.siteSettings.upsert({
      where: { id: 1 },
      update: {
        ...(storeName !== undefined && { storeName }),
        ...(tagline !== undefined && { tagline }),
        ...(primaryColor !== undefined && { primaryColor }),
        ...(heroHeadline !== undefined && { heroHeadline }),
        ...(heroYear !== undefined && { heroYear }),
        ...(heroDescription !== undefined && { heroDescription }),
        ...(contactAddress !== undefined && { contactAddress }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(contactEmail !== undefined && { contactEmail }),
      },
      create: {
        id: 1,
        storeName: storeName || "Mollari",
        tagline: tagline || "Clean · Cruelty-Free · Bangladesh",
        primaryColor: primaryColor || "#f01172",
        heroHeadline: heroHeadline || "Spring Beauty Collection",
        heroYear: heroYear || "2026",
        heroDescription: heroDescription || "Discover luxurious skincare and makeup that celebrates your natural glow. Clean, cruelty-free formulas delivered across Bangladesh in 48 hours.",
        contactAddress: contactAddress || "Dhaka, Bangladesh",
        contactPhone: contactPhone || "+880 1XXX-XXXXXX",
        contactEmail: contactEmail || "hello@mollari.com",
      },
    });

    await AuditLogger.log({
      req,
      action: beforeState ? 'UPDATE' : 'CREATE',
      entity: 'SiteSettings',
      entityId: '1',
      entityLabel: 'Site Configuration Settings',
      before: beforeState,
      after: settings,
    });

    await cacheDel(HP_KEYS.settings, HP_KEYS.state);
    res.json({ message: "Settings updated successfully", data: settings });
  } catch (error) {
    console.error("Error updating site settings:", error);
    res.status(500).json({ error: "Failed to update site settings" });
  }
});

/**
 * GET /api/homepage/slider
 * Fetch all active hero slider images.
 * Falls back to featured products when no manual slider entries exist.
 */
router.get("/slider", async (req, res) => {
  try {
    const cached = await cacheGet<any[]>(HP_KEYS.slider);
    if (cached) return res.json(cached);

    const sliders = await prisma.heroSlider.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });

    if (sliders.length > 0) {
      await cacheSet(HP_KEYS.slider, sliders, TTL.MEDIUM);
      return res.json(sliders);
    }

    // Fallback: build slider entries from featured products
    const featured = await prisma.product.findMany({
      where: { isFeatured: true, isActive: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: { category: true },
    });

    const productSliders = featured.map((p: any, i: number) => ({
      id: -(p.id),
      title: p.name,
      description: p.shortDescription || p.description || null,
      imageUrl: p.images?.[0] || "",
      imageAlt: p.name,
      buttonText: `Shop Now · ৳${Math.round(Number(p.price))}`,
      buttonLink: `/product/${p.slug}`,
      displayOrder: i,
      isActive: true,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    // Featured-product fallback: use SHORT TTL (5 min) so image/featured
    // changes propagate much faster than the manual-slider path (10 min).
    await cacheSet(HP_KEYS.slider, productSliders, TTL.SHORT);
    return res.json(productSliders);
  } catch (error) {
    console.error("Error fetching hero slider:", error);
    res.status(500).json({ error: "Failed to fetch hero slider" });
  }
});

/**
 * GET /api/homepage/slider/all
 * Fetch all hero slider images (including inactive) - Admin only
 */
router.get("/slider/all", async (req, res) => {
  try {
    const sliders = await prisma.heroSlider.findMany({
      orderBy: { displayOrder: "asc" },
    });
    res.json(sliders);
  } catch (error) {
    console.error("Error fetching all hero slider images:", error);
    res.status(500).json({ error: "Failed to fetch hero slider images" });
  }
});

/**
 * POST /api/homepage/slider
 * Create a new hero slider image (Admin only)
 */
router.post("/slider", authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER), async (req, res) => {
  try {
    const { title, description, imageUrl, imageAlt, buttonText, buttonLink, displayOrder } = req.body;
    if (!imageUrl) return res.status(400).json({ error: "imageUrl is required" });

    const slider = await prisma.heroSlider.create({
      data: {
        title: title || null,
        description: description || null,
        imageUrl,
        imageAlt: imageAlt || "Hero slider image",
        buttonText: buttonText || null,
        buttonLink: buttonLink || null,
        displayOrder: displayOrder || 0,
        isActive: true,
      },
    });

    await AuditLogger.log({
      req,
      action: 'CREATE',
      entity: 'HeroSlider',
      entityId: String(slider.id),
      entityLabel: `Hero Slider: ${slider.title || 'Untitled'}`,
      after: slider,
    });

    await cacheDel(HP_KEYS.slider);
    res.status(201).json({ message: "Slider image created successfully", data: slider });
  } catch (error) {
    console.error("Error creating hero slider image:", error);
    res.status(500).json({ error: "Failed to create hero slider image" });
  }
});

/**
 * PUT /api/homepage/slider/:id
 * Update a hero slider image (Admin only)
 */
router.put("/slider/:id", authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, imageUrl, imageAlt, buttonText, buttonLink, displayOrder, isActive } = req.body;

    const beforeState = await prisma.heroSlider.findUnique({
      where: { id: parseInt(id) }
    });

    const slider = await prisma.heroSlider.update({
      where: { id: parseInt(id) },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(imageAlt !== undefined && { imageAlt }),
        ...(buttonText !== undefined && { buttonText }),
        ...(buttonLink !== undefined && { buttonLink }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await AuditLogger.log({
      req,
      action: 'UPDATE',
      entity: 'HeroSlider',
      entityId: id,
      entityLabel: `Hero Slider: ${slider.title || 'Untitled'}`,
      before: beforeState,
      after: slider,
    });

    await cacheDel(HP_KEYS.slider);
    res.json({ message: "Slider image updated successfully", data: slider });
  } catch (error) {
    console.error("Error updating hero slider image:", error);
    res.status(500).json({ error: "Failed to update hero slider image" });
  }
});

/**
 * DELETE /api/homepage/slider/:id
 * Delete a hero slider image (Admin only)
 */
router.delete("/slider/:id", authenticate, authorize(USER_TYPE_CODES.SYSTEM_ADMIN, USER_TYPE_CODES.MANAGER), async (req, res) => {
  try {
    const { id } = req.params;

    const beforeState = await prisma.heroSlider.findUnique({
      where: { id: parseInt(id) }
    });

    await prisma.heroSlider.delete({ where: { id: parseInt(id) } });

    await AuditLogger.log({
      req,
      action: 'DELETE',
      entity: 'HeroSlider',
      entityId: id,
      entityLabel: beforeState ? `Hero Slider: ${beforeState.title || 'Untitled'}` : undefined,
      before: beforeState,
    });

    await cacheDel(HP_KEYS.slider);
    res.json({ message: "Slider image deleted successfully" });
  } catch (error) {
    console.error("Error deleting hero slider image:", error);
    res.status(500).json({ error: "Failed to delete hero slider image" });
  }
});

export default router;
