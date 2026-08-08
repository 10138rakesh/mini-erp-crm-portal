import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../types';
import { authenticateJWT, requireRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/customers (List with search, filter, pagination)
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const { search, customerType, status } = req.query;

    const whereClause: any = {};

    if (customerType) {
      whereClause.customerType = customerType as string;
    }

    if (status) {
      whereClause.status = status as string;
    }

    if (search) {
      const searchStr = search as string;
      whereClause.OR = [
        { name: { contains: searchStr } },
        { businessName: { contains: searchStr } },
        { email: { contains: searchStr } },
        { mobile: { contains: searchStr } },
      ];
    }

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where: whereClause }),
    ]);

    return res.json({
      customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Fetch customers error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/customers/:id (Details, follow-ups, and challans)
router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        followUps: {
          orderBy: { createdAt: 'desc' },
        },
        challans: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    return res.json(customer);
  } catch (error) {
    console.error('Fetch customer details error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/customers (Create - restricted to Admin and Sales)
router.post(
  '/',
  authenticateJWT,
  requireRole(['Sales']),
  async (req: AuthRequest, res: Response) => {
    const { name, mobile, email, businessName, gstNumber, customerType, address, status, followUpDate, notes } = req.body;

    if (!name || !mobile || !email || !businessName || !customerType || !address || !status) {
      return res.status(400).json({ error: 'Missing required customer fields' });
    }

    const validTypes = ['Retail', 'Wholesale', 'Distributor'];
    if (!validTypes.includes(customerType)) {
      return res.status(400).json({ error: 'Invalid customerType. Must be Retail, Wholesale, or Distributor' });
    }

    const validStatuses = ['Lead', 'Active', 'Inactive'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Lead, Active, or Inactive' });
    }

    try {
      const customer = await prisma.customer.create({
        data: {
          name,
          mobile,
          email,
          businessName,
          gstNumber: gstNumber || null,
          customerType,
          address,
          status,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          notes: notes || null,
        },
      });

      return res.status(201).json(customer);
    } catch (error) {
      console.error('Create customer error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/customers/:id (Update - restricted to Admin and Sales)
router.put(
  '/:id',
  authenticateJWT,
  requireRole(['Sales']),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, mobile, email, businessName, gstNumber, customerType, address, status, followUpDate, notes } = req.body;

    try {
      const existing = await prisma.customer.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          name: name ?? existing.name,
          mobile: mobile ?? existing.mobile,
          email: email ?? existing.email,
          businessName: businessName ?? existing.businessName,
          gstNumber: gstNumber !== undefined ? gstNumber : existing.gstNumber,
          customerType: customerType ?? existing.customerType,
          address: address ?? existing.address,
          status: status ?? existing.status,
          followUpDate: followUpDate !== undefined ? (followUpDate ? new Date(followUpDate) : null) : existing.followUpDate,
          notes: notes !== undefined ? notes : existing.notes,
        },
      });

      return res.json(updated);
    } catch (error) {
      console.error('Update customer error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/customers/:id/followups (Add follow-up note - restricted to Admin and Sales)
router.post(
  '/:id/followups',
  authenticateJWT,
  requireRole(['Sales']),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || note.trim() === '') {
      return res.status(400).json({ error: 'Note content cannot be empty' });
    }

    try {
      const customer = await prisma.customer.findUnique({ where: { id } });
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      const followUp = await prisma.followUpNote.create({
        data: {
          customerId: id,
          note,
          createdBy: req.user?.name || 'Unknown',
        },
      });

      return res.status(201).json(followUp);
    } catch (error) {
      console.error('Create follow-up note error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
