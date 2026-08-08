import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Helper to generate sequential Challan Number
async function generateChallanNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}${month}${day}`;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  let attempts = 0;
  while (attempts < 5) {
    const count = await prisma.challan.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const seq = String(count + 1 + attempts).padStart(4, '0');
    const challanNum = `CH-${todayStr}-${seq}`;

    // Verify uniqueness
    const existing = await prisma.challan.findUnique({
      where: { challanNumber: challanNum },
    });

    if (!existing) {
      return challanNum;
    }
    attempts++;
  }

  // Fallback to random identifier in the extremely rare case of collisions
  return `CH-${todayStr}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// GET /api/challans (List all challans)
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const challans = await prisma.challan.findMany({
      include: {
        customer: {
          select: {
            name: true,
            businessName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const parsedChallans = challans.map((c) => ({
      ...c,
      products: typeof c.products === 'string' ? JSON.parse(c.products) : c.products,
    }));

    return res.json(parsedChallans);
  } catch (error) {
    console.error('Fetch challans error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/challans/:id (Get details of single challan)
router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const challan = await prisma.challan.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!challan) {
      return res.status(404).json({ error: 'Challan not found' });
    }

    return res.json({
      ...challan,
      products: typeof challan.products === 'string' ? JSON.parse(challan.products) : challan.products,
    });
  } catch (error) {
    console.error('Fetch challan details error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/challans (Create Challan - Draft or Confirmed)
router.post(
  '/',
  authenticateJWT,
  requireRole(['Sales']),
  async (req: AuthRequest, res: Response) => {
    const { customerId, productsInput, status } = req.body;
    // productsInput is expected to be an array of: { productId: string, quantity: number }

    if (!customerId || !productsInput || !Array.isArray(productsInput) || productsInput.length === 0) {
      return res.status(400).json({ error: 'Customer and at least one product selection is required' });
    }

    const challanStatus = status || 'Draft';
    if (challanStatus !== 'Draft' && challanStatus !== 'Confirmed') {
      return res.status(400).json({ error: 'Initial challan status must be either Draft or Confirmed' });
    }

    try {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      // Fetch products to snapshot details and perform stock checks
      const productIds = productsInput.map((p: any) => p.productId);
      const dbProducts = await prisma.product.findMany({
        where: { id: { in: productIds } },
      });

      if (dbProducts.length !== productIds.length) {
        return res.status(400).json({ error: 'One or more selected products are invalid' });
      }

      const snapshots: any[] = [];
      let totalQuantity = 0;
      let totalAmount = 0;

      // Compile snapshots & check inventory availability
      for (const item of productsInput) {
        const product = dbProducts.find((p) => p.id === item.productId);
        if (!product) continue;

        const qty = parseInt(item.quantity);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ error: `Invalid quantity for product ${product.name}` });
        }

        if (challanStatus === 'Confirmed' && product.currentStock < qty) {
          return res.status(400).json({
            error: `Insufficient stock for product ${product.name}. Current stock: ${product.currentStock}, requested: ${qty}.`,
          });
        }

        snapshots.push({
          productId: product.id,
          name: product.name,
          sku: product.sku,
          price: product.unitPrice,
          quantity: qty,
        });

        totalQuantity += qty;
        totalAmount += product.unitPrice * qty;
      }

      const challanNumber = await generateChallanNumber();

      const newChallan = await prisma.$transaction(async (tx) => {
        // If Confirmed, deduct stock and write movements
        if (challanStatus === 'Confirmed') {
          for (const snapshot of snapshots) {
            // Deduct stock
            await tx.product.update({
              where: { id: snapshot.productId },
              data: {
                currentStock: {
                  decrement: snapshot.quantity,
                },
              },
            });

            // Log stock movement OUT
            await tx.stockMovement.create({
              data: {
                productId: snapshot.productId,
                quantity: snapshot.quantity,
                movementType: 'OUT',
                reason: `Sales Challan ${challanNumber}`,
                createdBy: req.user?.name || 'Sales Executive',
              },
            });
          }
        }

        // Create challan
        const created = await tx.challan.create({
          data: {
            challanNumber,
            customerId,
            products: JSON.stringify(snapshots),
            totalQuantity,
            totalAmount,
            status: challanStatus,
            createdBy: req.user?.name || 'Sales Executive',
          },
        });

        return created;
      });

      return res.status(201).json(newChallan);
    } catch (error: any) {
      console.error('Create challan error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/challans/:id/status (Update Status: Confirmed or Cancelled)
router.put(
  '/:id/status',
  authenticateJWT,
  // We can let Sales confirm drafts, and Admin cancel confirmed ones. 
  // Let's restrict status change to Admin, Sales (confirming), and Accounts/Warehouse (can read, but let's restrict status modifications to Admin, Sales, and Warehouse)
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body; // 'Confirmed' or 'Cancelled'

    if (status !== 'Confirmed' && status !== 'Cancelled') {
      return res.status(400).json({ error: 'Invalid target status. Must be Confirmed or Cancelled' });
    }

    try {
      const challan = await prisma.challan.findUnique({
        where: { id },
      });

      if (!challan) {
        return res.status(404).json({ error: 'Challan not found' });
      }

      const currentStatus = challan.status;

      if (currentStatus === status) {
        return res.status(400).json({ error: `Challan is already in ${status} status` });
      }

      if (currentStatus === 'Cancelled') {
        return res.status(400).json({ error: 'Cannot modify a cancelled challan' });
      }

      const productsList: any[] = typeof challan.products === 'string' ? JSON.parse(challan.products) : challan.products;

      // 1. Transition: Draft -> Confirmed
      if (currentStatus === 'Draft' && status === 'Confirmed') {
        // Validate stock before changing status
        const productIds = productsList.map((p) => p.productId);
        const dbProducts = await prisma.product.findMany({
          where: { id: { in: productIds } },
        });

        for (const item of productsList) {
          const dbProduct = dbProducts.find((p) => p.id === item.productId);
          if (!dbProduct || dbProduct.currentStock < item.quantity) {
            const currentStockInfo = dbProduct ? dbProduct.currentStock : 0;
            return res.status(400).json({
              error: `Insufficient stock for product ${item.name}. Current stock: ${currentStockInfo}, requested: ${item.quantity}.`,
            });
          }
        }

        const updatedChallan = await prisma.$transaction(async (tx) => {
          for (const item of productsList) {
            // Deduct stock
            await tx.product.update({
              where: { id: item.productId },
              data: {
                currentStock: {
                  decrement: item.quantity,
                },
              },
            });

            // Log stock movement
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                quantity: item.quantity,
                movementType: 'OUT',
                reason: `Sales Challan ${challan.challanNumber}`,
                createdBy: req.user?.name || 'Sales Executive',
              },
            });
          }

          // Update Challan Status
          return await tx.challan.update({
            where: { id },
            data: { status: 'Confirmed' },
          });
        });

        return res.json(updatedChallan);
      }

      // 2. Transition: Confirmed -> Cancelled (restores stock)
      if (currentStatus === 'Confirmed' && status === 'Cancelled') {
        const updatedChallan = await prisma.$transaction(async (tx) => {
          for (const item of productsList) {
            // Restore stock
            await tx.product.update({
              where: { id: item.productId },
              data: {
                currentStock: {
                  increment: item.quantity,
                },
              },
            });

            // Log stock movement IN
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                quantity: item.quantity,
                movementType: 'IN',
                reason: `Cancelled Challan ${challan.challanNumber}`,
                createdBy: req.user?.name || 'Sales Executive',
              },
            });
          }

          // Update Challan Status
          return await tx.challan.update({
            where: { id },
            data: { status: 'Cancelled' },
          });
        });

        return res.json(updatedChallan);
      }

      // 3. Transition: Draft -> Cancelled (no stock movements needed)
      if (currentStatus === 'Draft' && status === 'Cancelled') {
        const updatedChallan = await prisma.challan.update({
          where: { id },
          data: { status: 'Cancelled' },
        });
        return res.json(updatedChallan);
      }

      return res.status(400).json({ error: 'Invalid state transition' });
    } catch (error) {
      console.error('Update challan status error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
