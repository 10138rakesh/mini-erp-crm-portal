import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clean existing records
  await prisma.followUpNote.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.challan.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Seed Users
  const salt = await bcrypt.genSalt(10);
  const passwordAdmin = await bcrypt.hash('admin123', salt);
  const passwordSales = await bcrypt.hash('sales123', salt);
  const passwordWarehouse = await bcrypt.hash('warehouse123', salt);
  const passwordAccounts = await bcrypt.hash('accounts123', salt);

  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password: passwordAdmin,
      name: 'Admin User',
      role: 'Admin',
    },
  });

  const sales = await prisma.user.create({
    data: {
      username: 'sales',
      password: passwordSales,
      name: 'Sales Executive',
      role: 'Sales',
    },
  });

  const warehouse = await prisma.user.create({
    data: {
      username: 'warehouse',
      password: passwordWarehouse,
      name: 'Warehouse Manager',
      role: 'Warehouse',
    },
  });

  const accounts = await prisma.user.create({
    data: {
      username: 'accounts',
      password: passwordAccounts,
      name: 'Accounts Executive',
      role: 'Accounts',
    },
  });

  console.log('Users seeded successfully!');

  // 3. Seed Customers
  const customer1 = await prisma.customer.create({
    data: {
      name: 'John Doe',
      mobile: '9876543210',
      email: 'john@doeretail.com',
      businessName: 'Doe Retailers',
      gstNumber: '29AAAAA1111A1Z1',
      customerType: 'Retail',
      address: '123 Main Street, Bangalore, Karnataka - 560001',
      status: 'Active',
      notes: 'Prefers deliveries on weekdays.',
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      name: 'Jane Smith',
      mobile: '8765432109',
      email: 'jane@smithwholesale.com',
      businessName: 'Smith Wholesalers',
      gstNumber: '29BBBBB2222B2Z2',
      customerType: 'Wholesale',
      address: '456 Commercial Road, Mumbai, Maharashtra - 400001',
      status: 'Active',
      notes: 'Requires bulk packaging for all orders.',
    },
  });

  const customer3 = await prisma.customer.create({
    data: {
      name: 'Bob Johnson',
      mobile: '7654321098',
      email: 'bob@distributors.com',
      businessName: 'Bobs Distributors',
      customerType: 'Distributor',
      address: '789 Logistics Park, Chennai, Tamil Nadu - 600001',
      status: 'Lead',
      notes: 'Interested in Widget A distribution rights.',
      followUpDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    },
  });

  // Seed some initial follow-ups
  await prisma.followUpNote.create({
    data: {
      customerId: customer3.id,
      note: 'Initial call completed. Requested a quote for 1000 Widget A units.',
      createdBy: 'Sales Executive',
    },
  });

  console.log('Customers and Follow-ups seeded successfully!');

  // 4. Seed Products
  const p1 = await prisma.product.create({
    data: {
      name: 'Widget A',
      sku: 'WDGT-A',
      category: 'Widgets',
      unitPrice: 10.00,
      currentStock: 50,
      minStockAlert: 10,
      location: 'Aisle 1-A',
    },
  });

  const p2 = await prisma.product.create({
    data: {
      name: 'Gadget B',
      sku: 'GDGT-B',
      category: 'Gadgets',
      unitPrice: 25.50,
      currentStock: 5, // Low stock!
      minStockAlert: 10,
      location: 'Aisle 2-B',
    },
  });

  const p3 = await prisma.product.create({
    data: {
      name: 'Tool C',
      sku: 'TOOL-C',
      category: 'Tools',
      unitPrice: 99.99,
      currentStock: 15,
      minStockAlert: 5,
      location: 'Aisle 3-C',
    },
  });

  // Seed initial stock movements
  await prisma.stockMovement.create({
    data: {
      productId: p1.id,
      quantity: 50,
      movementType: 'IN',
      reason: 'Purchase',
      createdBy: 'Warehouse Manager',
    },
  });

  await prisma.stockMovement.create({
    data: {
      productId: p2.id,
      quantity: 5,
      movementType: 'IN',
      reason: 'Purchase',
      createdBy: 'Warehouse Manager',
    },
  });

  await prisma.stockMovement.create({
    data: {
      productId: p3.id,
      quantity: 15,
      movementType: 'IN',
      reason: 'Purchase',
      createdBy: 'Warehouse Manager',
    },
  });

  console.log('Products and Stock Movements seeded successfully!');
  console.log('Database seeding finished.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
