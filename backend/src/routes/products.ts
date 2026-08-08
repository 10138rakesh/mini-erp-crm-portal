import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/products (List products, including low-stock alerts)
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
    });

    // We can enrich the response with a calculated isLowStock field
    const productsWithAlerts = products.map((product) => ({
      ...product,
      isLowStock: product.currentStock <= product.minStockAlert,
    }));

    return res.json(productsWithAlerts);
  } catch (error) {
    console.error('Fetch products error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/movements (Get global stock movement logs - restricted to Admin and Warehouse)
router.get(
  '/movements',
  authenticateJWT,
  requireRole(['Warehouse']),
  async (req: AuthRequest, res: Response) => {
    try {
      const movements = await prisma.stockMovement.findMany({
        include: {
          product: {
            select: {
              name: true,
              sku: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
      });
      return res.json(movements);
    } catch (error) {
      console.error('Fetch stock movements error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/products (Create product - restricted to Admin and Warehouse)
router.post(
  '/',
  authenticateJWT,
  requireRole(['Warehouse']),
  async (req: AuthRequest, res: Response) => {
    const { name, sku, category, unitPrice, currentStock, minStockAlert, location } = req.body;

    if (!name || !sku || !category || unitPrice === undefined || currentStock === undefined || minStockAlert === undefined || !location) {
      return res.status(400).json({ error: 'Missing required product fields' });
    }

    try {
      // Validate SKU uniqueness
      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) {
        return res.status(400).json({ error: 'Product SKU must be unique' });
      }

      // Create product and log initial stock if stock is > 0
      const product = await prisma.$transaction(async (tx) => {
        const newProduct = await tx.product.create({
          data: {
            name,
            sku,
            category,
            unitPrice: parseFloat(unitPrice),
            currentStock: parseInt(currentStock),
            minStockAlert: parseInt(minStockAlert),
            location,
          },
        });

        if (parseInt(currentStock) > 0) {
          await tx.stockMovement.create({
            data: {
              productId: newProduct.id,
              quantity: parseInt(currentStock),
              movementType: 'IN',
              reason: 'Initial Seeding / Stock Addition',
              createdBy: req.user?.name || 'Unknown',
            },
          });
        }

        return newProduct;
      });

      return res.status(201).json(product);
    } catch (error) {
      console.error('Create product error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/products/:id (Update product - restricted to Admin and Warehouse)
router.put(
  '/:id',
  authenticateJWT,
  requireRole(['Warehouse']),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, sku, category, unitPrice, minStockAlert, location } = req.body;

    try {
      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (sku && sku !== existing.sku) {
        const skuCheck = await prisma.product.findUnique({ where: { sku } });
        if (skuCheck) {
          return res.status(400).json({ error: 'Product SKU must be unique' });
        }
      }

      const updated = await prisma.product.update({
        where: { id },
        data: {
          name: name ?? existing.name,
          sku: sku ?? existing.sku,
          category: category ?? existing.category,
          unitPrice: unitPrice !== undefined ? parseFloat(unitPrice) : existing.unitPrice,
          minStockAlert: minStockAlert !== undefined ? parseInt(minStockAlert) : existing.minStockAlert,
          location: location ?? existing.location,
        },
      });

      return res.json(updated);
    } catch (error) {
      console.error('Update product error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/products/:id/adjust (Manual Stock Adjustment - restricted to Admin and Warehouse)
router.post(
  '/:id/adjust',
  authenticateJWT,
  requireRole(['Warehouse']),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { quantity, movementType, reason } = req.body;

    if (quantity === undefined || !movementType || !reason) {
      return res.status(400).json({ error: 'Missing adjustment parameters' });
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }

    if (movementType !== 'IN' && movementType !== 'OUT') {
      return res.status(400).json({ error: 'Movement type must be IN or OUT' });
    }

    try {
      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Check if stock subtraction leads to negative stock
      if (movementType === 'OUT' && product.currentStock - qty < 0) {
        return res.status(400).json({ error: `Insufficient stock. Current stock is ${product.currentStock}.` });
      }

      const updatedProduct = await prisma.$transaction(async (tx) => {
        // Adjust product stock
        const newStock = movementType === 'IN' ? product.currentStock + qty : product.currentStock - qty;

        const updated = await tx.product.update({
          where: { id },
          data: { currentStock: newStock },
        });

        // Log movement
        await tx.stockMovement.create({
          data: {
            productId: id,
            quantity: qty,
            movementType,
            reason,
            createdBy: req.user?.name || 'Unknown',
          },
        });

        return updated;
      });

      return res.json(updatedProduct);
    } catch (error) {
      console.error('Stock adjustment error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
