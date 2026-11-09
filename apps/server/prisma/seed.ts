import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Development-only credential. Documented in the README; never used in production. */
const DEV_PASSWORD = 'ProcureFlow!2026';
const WORKSPACE_SLUG = 'northwind-industrial';

const now = new Date();

function daysAgo(days: number, hour = 10): Date {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

function daysFromNow(days: number, hour = 17): Date {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

function decimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

interface SeedItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  notes?: string;
}

function buildItem(item: SeedItem) {
  const quantity = decimal(item.quantity);
  const unitPrice = decimal(item.unitPrice);

  return {
    description: item.description,
    quantity,
    unit: item.unit,
    unitPrice,
    lineTotal: quantity.mul(unitPrice),
    ...(item.notes ? { notes: item.notes } : {}),
  };
}

function sumItems(items: ReturnType<typeof buildItem>[]): Prisma.Decimal {
  return items.reduce((total, item) => total.add(item.lineTotal), decimal(0));
}

async function seedUsers(passwordHash: string) {
  const people = [
    {
      email: 'amara.okafor@northwind.example',
      firstName: 'Amara',
      lastName: 'Okafor',
      jobTitle: 'Head of Procurement',
    },
    {
      email: 'daniel.reyes@northwind.example',
      firstName: 'Daniel',
      lastName: 'Reyes',
      jobTitle: 'Finance Director',
    },
    {
      email: 'priya.nair@northwind.example',
      firstName: 'Priya',
      lastName: 'Nair',
      jobTitle: 'Operations Lead',
    },
    {
      email: 'marcus.chen@northwind.example',
      firstName: 'Marcus',
      lastName: 'Chen',
      jobTitle: 'Senior Buyer',
    },
    {
      email: 'sofia.lindberg@northwind.example',
      firstName: 'Sofia',
      lastName: 'Lindberg',
      jobTitle: 'Compliance Manager',
    },
  ];

  const users = [];

  for (const person of people) {
    users.push(
      await prisma.user.upsert({
        where: { email: person.email },
        update: {
          firstName: person.firstName,
          lastName: person.lastName,
          jobTitle: person.jobTitle,
          passwordHash,
        },
        create: {
          ...person,
          passwordHash,
        },
      }),
    );
  }

  const byEmail = new Map(users.map((user) => [user.email, user]));

  return {
    amara: byEmail.get('amara.okafor@northwind.example')!,
    daniel: byEmail.get('daniel.reyes@northwind.example')!,
    priya: byEmail.get('priya.nair@northwind.example')!,
    marcus: byEmail.get('marcus.chen@northwind.example')!,
    sofia: byEmail.get('sofia.lindberg@northwind.example')!,
  };
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);
  const people = await seedUsers(passwordHash);

  const existingWorkspace = await prisma.workspace.findUnique({
    where: { slug: WORKSPACE_SLUG },
    select: { id: true },
  });

  if (existingWorkspace) {
    await prisma.workspace.delete({ where: { id: existingWorkspace.id } });
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: 'Northwind Industrial',
      slug: WORKSPACE_SLUG,
      description: 'Procurement operations for Northwind Industrial and its regional sites.',
      currency: 'USD',
      createdById: people.amara.id,
      members: {
        create: [
          { userId: people.amara.id, role: 'owner', joinedAt: daysAgo(420, 9) },
          { userId: people.daniel.id, role: 'admin', joinedAt: daysAgo(398, 9) },
          { userId: people.priya.id, role: 'approver', joinedAt: daysAgo(355, 9) },
          { userId: people.marcus.id, role: 'buyer', joinedAt: daysAgo(301, 9) },
          { userId: people.sofia.id, role: 'viewer', joinedAt: daysAgo(188, 9) },
        ],
      },
    },
  });

  const vendorSeed = [
    {
      name: 'Meridian Office Systems',
      code: 'VND-001',
      category: 'operations' as const,
      status: 'active' as const,
      contactName: 'Elena Marsh',
      email: 'elena.marsh@meridian.example',
      phone: '+1 415 555 0142',
      website: 'https://meridian.example',
      city: 'San Francisco',
      region: 'California',
      country: 'United States',
      paymentTerms: 'Net 30',
      notes: 'Preferred supplier for workplace furniture and office supplies.',
    },
    {
      name: 'Atlas Industrial Supply',
      code: 'VND-002',
      category: 'operations' as const,
      status: 'active' as const,
      contactName: 'Owen Barrett',
      email: 'owen.barrett@atlas.example',
      phone: '+1 312 555 0198',
      city: 'Chicago',
      region: 'Illinois',
      country: 'United States',
      paymentTerms: 'Net 45',
      notes: 'Warehouse consumables and industrial safety equipment.',
    },
    {
      name: 'Lumen Technology Partners',
      code: 'VND-003',
      category: 'information_technology' as const,
      status: 'active' as const,
      contactName: 'Grace Kim',
      email: 'grace.kim@lumen.example',
      phone: '+1 206 555 0117',
      city: 'Seattle',
      region: 'Washington',
      country: 'United States',
      paymentTerms: 'Net 30',
      notes: 'Hardware, endpoint refresh and managed deployment services.',
    },
    {
      name: 'Verdant Facilities Co.',
      code: 'VND-004',
      category: 'facilities' as const,
      status: 'active' as const,
      contactName: 'Noah Fischer',
      email: 'noah.fischer@verdant.example',
      phone: '+1 512 555 0164',
      city: 'Austin',
      region: 'Texas',
      country: 'United States',
      paymentTerms: 'Net 30',
      notes: 'Workplace retrofit, maintenance and critical facilities support.',
    },
    {
      name: 'Pacific Freight Lines',
      code: 'VND-005',
      category: 'logistics' as const,
      status: 'inactive' as const,
      contactName: 'Hana Sato',
      email: 'hana.sato@pacificfreight.example',
      phone: '+1 503 555 0121',
      city: 'Portland',
      region: 'Oregon',
      country: 'United States',
      paymentTerms: 'Net 15',
      notes: 'Regional freight partner. Contract renewal under review.',
    },
    {
      name: 'Cascade Packaging Group',
      code: 'VND-006',
      category: 'operations' as const,
      status: 'active' as const,
      contactName: 'Miles Turner',
      email: 'miles.turner@cascade.example',
      phone: '+1 503 555 0189',
      city: 'Portland',
      region: 'Oregon',
      country: 'United States',
      paymentTerms: 'Net 30',
      notes: 'Sustainable packaging and fulfilment consumables.',
    },
    {
      name: 'Cedar & Co. Professional Services',
      code: 'VND-007',
      category: 'professional_services' as const,
      status: 'onboarding' as const,
      contactName: 'Iris Bell',
      email: 'iris.bell@cedar.example',
      phone: '+1 646 555 0173',
      city: 'New York',
      region: 'New York',
      country: 'United States',
      paymentTerms: 'Net 30',
      notes: 'Compliance training and professional services. Onboarding in progress.',
    },
  ];

  const vendors = new Map<string, { id: string }>();

  for (const vendor of vendorSeed) {
    const createdVendor = await prisma.vendor.create({
      data: {
        workspaceId: workspace.id,
        ...vendor,
      },
    });
    vendors.set(vendor.code, createdVendor);
  }

  const vendor = (code: string) => {
    const found = vendors.get(code);

    if (!found) {
      throw new Error(`Seed vendor ${code} was not created.`);
    }

    return found;
  };

  // ---------------------------------------------------------------------------
  // PR-2026-0142 — pending approval, with a multi-step approval and two quotes.
  // ---------------------------------------------------------------------------
  const workstationItems = [
    buildItem({
      description: 'ThinkPad P1 Gen 7 mobile workstation',
      quantity: '12',
      unit: 'unit',
      unitPrice: '5200.00',
      notes: '16-inch display, 64 GB memory, 1 TB storage.',
    }),
    buildItem({
      description: '27-inch 4K USB-C monitor',
      quantity: '12',
      unit: 'unit',
      unitPrice: '780.00',
    }),
    buildItem({
      description: 'Thunderbolt 4 docking station',
      quantity: '12',
      unit: 'unit',
      unitPrice: '350.00',
    }),
    buildItem({
      description: '3-year accidental damage warranty',
      quantity: '12',
      unit: 'unit',
      unitPrice: '750.00',
    }),
  ];

  const workstationRequest = await prisma.purchaseRequest.create({
    data: {
      workspaceId: workspace.id,
      requestNumber: 'PR-2026-0142',
      title: 'Q4 engineering workstation refresh',
      description:
        'Refresh the engineering workstation fleet ahead of the January product release cycle.',
      status: 'pending_approval',
      priority: 'high',
      category: 'information_technology',
      currency: 'USD',
      totalAmount: sumItems(workstationItems),
      department: 'Product Engineering',
      neededBy: daysFromNow(21),
      submittedAt: daysAgo(3, 9),
      requestedById: people.marcus.id,
      items: { create: workstationItems },
    },
    include: { items: true },
  });

  await prisma.approval.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: workstationRequest.id,
      status: 'pending',
      currentStep: 2,
      requestedAt: daysAgo(3, 9),
      steps: {
        create: [
          {
            stepOrder: 1,
            name: 'Department head review',
            approverId: people.priya.id,
            status: 'approved',
            decisionNote: 'Headcount and refresh cycle are aligned with the engineering plan.',
            decidedAt: daysAgo(2, 14),
          },
          {
            stepOrder: 2,
            name: 'Finance review',
            approverId: people.daniel.id,
            status: 'pending',
          },
          {
            stepOrder: 3,
            name: 'Procurement sign-off',
            approverId: people.amara.id,
            status: 'pending',
          },
        ],
      },
    },
  });

  const lumenQuoteItems = [
    buildItem({
      description: 'ThinkPad P1 Gen 7 mobile workstation',
      quantity: '12',
      unit: 'unit',
      unitPrice: '5050.00',
    }),
    buildItem({
      description: '27-inch 4K USB-C monitor',
      quantity: '12',
      unit: 'unit',
      unitPrice: '760.00',
    }),
    buildItem({
      description: 'Thunderbolt 4 docking station',
      quantity: '12',
      unit: 'unit',
      unitPrice: '340.00',
    }),
    buildItem({
      description: '3-year accidental damage warranty',
      quantity: '12',
      unit: 'unit',
      unitPrice: '720.00',
    }),
  ];

  const lumenSubtotal = sumItems(lumenQuoteItems);
  const lumenTax = lumenSubtotal.mul('0.08');

  const lumenQuote = await prisma.quotation.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: workstationRequest.id,
      vendorId: vendor('VND-003').id,
      quotationNumber: 'QT-2026-0311',
      status: 'submitted',
      currency: 'USD',
      subtotal: lumenSubtotal,
      taxAmount: lumenTax,
      totalAmount: lumenSubtotal.add(lumenTax),
      validUntil: daysFromNow(24),
      submittedAt: daysAgo(2, 11),
      notes: 'Includes staged deployment and asset tagging.',
      items: {
        create: lumenQuoteItems.map((item, index) => ({
          ...item,
          purchaseRequestItemId: workstationRequest.items[index]?.id,
          leadTimeDays: 14,
        })),
      },
    },
  });

  const meridianQuoteItems = [
    buildItem({
      description: 'ThinkPad P1 Gen 7 mobile workstation',
      quantity: '12',
      unit: 'unit',
      unitPrice: '5300.00',
    }),
    buildItem({
      description: '27-inch 4K USB-C monitor',
      quantity: '12',
      unit: 'unit',
      unitPrice: '790.00',
    }),
    buildItem({
      description: 'Thunderbolt 4 docking station',
      quantity: '12',
      unit: 'unit',
      unitPrice: '360.00',
    }),
    buildItem({
      description: '3-year accidental damage warranty',
      quantity: '12',
      unit: 'unit',
      unitPrice: '760.00',
    }),
  ];

  const meridianSubtotal = sumItems(meridianQuoteItems);
  const meridianTax = meridianSubtotal.mul('0.08');

  const meridianQuote = await prisma.quotation.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: workstationRequest.id,
      vendorId: vendor('VND-001').id,
      quotationNumber: 'QT-2026-0312',
      status: 'submitted',
      currency: 'USD',
      subtotal: meridianSubtotal,
      taxAmount: meridianTax,
      totalAmount: meridianSubtotal.add(meridianTax),
      validUntil: daysFromNow(18),
      submittedAt: daysAgo(2, 15),
      notes: 'Standard delivery in 21 days; white-glove setup available separately.',
      items: {
        create: meridianQuoteItems.map((item, index) => ({
          ...item,
          purchaseRequestItemId: workstationRequest.items[index]?.id,
          leadTimeDays: 21,
        })),
      },
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        workspaceId: workspace.id,
        actorId: people.marcus.id,
        action: 'purchase_request.submitted',
        entityType: 'purchase_request',
        entityId: workstationRequest.id,
        summary: 'Submitted PR-2026-0142 for approval.',
        metadata: { requestNumber: 'PR-2026-0142' },
        createdAt: daysAgo(3, 9),
      },
      {
        workspaceId: workspace.id,
        actorId: people.priya.id,
        action: 'approval.step.approved',
        entityType: 'purchase_request',
        entityId: workstationRequest.id,
        summary: 'Approved the department head review for PR-2026-0142.',
        metadata: { stepOrder: 1 },
        createdAt: daysAgo(2, 14),
      },
      {
        workspaceId: workspace.id,
        actorId: people.marcus.id,
        action: 'quotation.submitted',
        entityType: 'quotation',
        entityId: lumenQuote.id,
        summary: 'Recorded quotation QT-2026-0311 from Lumen Technology Partners.',
        metadata: { quotationNumber: 'QT-2026-0311' },
        createdAt: daysAgo(2, 11),
      },
      {
        workspaceId: workspace.id,
        actorId: people.marcus.id,
        action: 'quotation.submitted',
        entityType: 'quotation',
        entityId: meridianQuote.id,
        summary: 'Recorded quotation QT-2026-0312 from Meridian Office Systems.',
        metadata: { quotationNumber: 'QT-2026-0312' },
        createdAt: daysAgo(2, 15),
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // PR-2026-0138 — approved furniture retrofit, selected quote and live PO.
  // ---------------------------------------------------------------------------
  const furnitureItems = [
    buildItem({
      description: 'Ergonomic task chair',
      quantity: '24',
      unit: 'unit',
      unitPrice: '640.00',
    }),
    buildItem({
      description: 'Height-adjustable desk',
      quantity: '24',
      unit: 'unit',
      unitPrice: '1150.00',
    }),
    buildItem({
      description: 'Eight-seat meeting table',
      quantity: '2',
      unit: 'unit',
      unitPrice: '1660.00',
    }),
  ];

  const furnitureRequest = await prisma.purchaseRequest.create({
    data: {
      workspaceId: workspace.id,
      requestNumber: 'PR-2026-0138',
      title: 'Regional office furniture retrofit',
      description: 'Replace end-of-life furniture across the Austin collaboration floor.',
      status: 'approved',
      priority: 'medium',
      category: 'facilities',
      currency: 'USD',
      totalAmount: sumItems(furnitureItems),
      department: 'Workplace Experience',
      neededBy: daysFromNow(14),
      submittedAt: daysAgo(10, 9),
      decidedAt: daysAgo(7, 16),
      requestedById: people.priya.id,
      items: { create: furnitureItems },
    },
    include: { items: true },
  });

  await prisma.approval.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: furnitureRequest.id,
      status: 'approved',
      currentStep: 2,
      requestedAt: daysAgo(10, 9),
      completedAt: daysAgo(7, 16),
      steps: {
        create: [
          {
            stepOrder: 1,
            name: 'Workplace lead review',
            approverId: people.amara.id,
            status: 'approved',
            decisionNote: 'Scope matches the approved workplace plan.',
            decidedAt: daysAgo(8, 11),
          },
          {
            stepOrder: 2,
            name: 'Finance review',
            approverId: people.daniel.id,
            status: 'approved',
            decisionNote: 'Within the facilities capital allocation.',
            decidedAt: daysAgo(7, 16),
          },
        ],
      },
    },
  });

  const verdantQuoteItems = [
    buildItem({
      description: 'Ergonomic task chair',
      quantity: '24',
      unit: 'unit',
      unitPrice: '620.00',
    }),
    buildItem({
      description: 'Height-adjustable desk',
      quantity: '24',
      unit: 'unit',
      unitPrice: '1120.00',
    }),
    buildItem({
      description: 'Eight-seat meeting table',
      quantity: '2',
      unit: 'unit',
      unitPrice: '1580.00',
    }),
  ];

  const verdantSubtotal = sumItems(verdantQuoteItems);
  const verdantTax = verdantSubtotal.mul('0.08');

  const verdantQuote = await prisma.quotation.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: furnitureRequest.id,
      vendorId: vendor('VND-004').id,
      quotationNumber: 'QT-2026-0298',
      status: 'selected',
      currency: 'USD',
      subtotal: verdantSubtotal,
      taxAmount: verdantTax,
      totalAmount: verdantSubtotal.add(verdantTax),
      validUntil: daysFromNow(12),
      submittedAt: daysAgo(9, 13),
      notes: 'Includes delivery, installation and packaging removal.',
      items: {
        create: verdantQuoteItems.map((item, index) => ({
          ...item,
          purchaseRequestItemId: furnitureRequest.items[index]?.id,
          leadTimeDays: 18,
        })),
      },
    },
  });

  const meridianFurnitureItems = [
    buildItem({
      description: 'Ergonomic task chair',
      quantity: '24',
      unit: 'unit',
      unitPrice: '650.00',
    }),
    buildItem({
      description: 'Height-adjustable desk',
      quantity: '24',
      unit: 'unit',
      unitPrice: '1190.00',
    }),
    buildItem({
      description: 'Eight-seat meeting table',
      quantity: '2',
      unit: 'unit',
      unitPrice: '1650.00',
    }),
  ];

  const meridianFurnitureSubtotal = sumItems(meridianFurnitureItems);
  const meridianFurnitureTax = meridianFurnitureSubtotal.mul('0.08');

  await prisma.quotation.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: furnitureRequest.id,
      vendorId: vendor('VND-001').id,
      quotationNumber: 'QT-2026-0299',
      status: 'rejected',
      currency: 'USD',
      subtotal: meridianFurnitureSubtotal,
      taxAmount: meridianFurnitureTax,
      totalAmount: meridianFurnitureSubtotal.add(meridianFurnitureTax),
      validUntil: daysFromNow(10),
      submittedAt: daysAgo(9, 16),
      notes: 'Installation quoted as a separate line item.',
      items: {
        create: meridianFurnitureItems.map((item, index) => ({
          ...item,
          purchaseRequestItemId: furnitureRequest.items[index]?.id,
          leadTimeDays: 24,
        })),
      },
    },
  });

  const furnitureOrder = await prisma.purchaseOrder.create({
    data: {
      workspaceId: workspace.id,
      poNumber: 'PO-2026-0087',
      purchaseRequestId: furnitureRequest.id,
      vendorId: vendor('VND-004').id,
      quotationId: verdantQuote.id,
      status: 'partially_delivered',
      currency: 'USD',
      subtotal: verdantSubtotal,
      taxAmount: verdantTax,
      totalAmount: verdantSubtotal.add(verdantTax),
      issuedAt: daysAgo(6, 10),
      expectedDeliveryDate: daysFromNow(10),
      notes: 'Split delivery agreed with the vendor to minimise floor downtime.',
      createdById: people.marcus.id,
      items: {
        create: [
          {
            description: 'Ergonomic task chair',
            quantity: decimal('24'),
            unit: 'unit',
            unitPrice: decimal('620.00'),
            lineTotal: decimal('14880.00'),
            receivedQuantity: decimal('12'),
          },
          {
            description: 'Height-adjustable desk',
            quantity: decimal('24'),
            unit: 'unit',
            unitPrice: decimal('1120.00'),
            lineTotal: decimal('26880.00'),
            receivedQuantity: decimal('8'),
          },
          {
            description: 'Eight-seat meeting table',
            quantity: decimal('2'),
            unit: 'unit',
            unitPrice: decimal('1580.00'),
            lineTotal: decimal('3160.00'),
            receivedQuantity: decimal('0'),
          },
        ],
      },
    },
  });

  await prisma.delivery.createMany({
    data: [
      {
        workspaceId: workspace.id,
        purchaseOrderId: furnitureOrder.id,
        deliveryNumber: 'DEL-2026-0201',
        status: 'delivered',
        carrier: 'Northwind Fleet',
        trackingNumber: 'NWF-5521-008',
        scheduledAt: daysAgo(3, 8),
        deliveredAt: daysAgo(1, 14),
        receivedById: people.marcus.id,
        notes: 'Chairs delivered in full. Two desk cartons held for replacement.',
      },
      {
        workspaceId: workspace.id,
        purchaseOrderId: furnitureOrder.id,
        deliveryNumber: 'DEL-2026-0214',
        status: 'in_transit',
        carrier: 'Swiftway Logistics',
        trackingNumber: 'SWY-8842-119',
        scheduledAt: daysFromNow(3, 11),
        notes: 'Remaining desks and both meeting tables.',
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        workspaceId: workspace.id,
        actorId: people.priya.id,
        action: 'purchase_request.submitted',
        entityType: 'purchase_request',
        entityId: furnitureRequest.id,
        summary: 'Submitted PR-2026-0138 for approval.',
        metadata: { requestNumber: 'PR-2026-0138' },
        createdAt: daysAgo(10, 9),
      },
      {
        workspaceId: workspace.id,
        actorId: people.daniel.id,
        action: 'approval.completed',
        entityType: 'purchase_request',
        entityId: furnitureRequest.id,
        summary: 'Approved PR-2026-0138 after finance review.',
        metadata: { requestNumber: 'PR-2026-0138' },
        createdAt: daysAgo(7, 16),
      },
      {
        workspaceId: workspace.id,
        actorId: people.marcus.id,
        action: 'purchase_order.issued',
        entityType: 'purchase_order',
        entityId: furnitureOrder.id,
        summary: 'Issued PO-2026-0087 to Verdant Facilities Co.',
        metadata: { poNumber: 'PO-2026-0087' },
        createdAt: daysAgo(6, 10),
      },
      {
        workspaceId: workspace.id,
        actorId: people.marcus.id,
        action: 'delivery.received',
        entityType: 'delivery',
        entityId: furnitureOrder.id,
        summary: 'Received the first furniture delivery against PO-2026-0087.',
        metadata: { deliveryNumber: 'DEL-2026-0201' },
        createdAt: daysAgo(1, 14),
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // PR-2026-0146 — approved facilities maintenance, issued PO.
  // ---------------------------------------------------------------------------
  const coolingItems = [
    buildItem({
      description: 'Precision cooling service visit',
      quantity: '4',
      unit: 'visit',
      unitPrice: '4200.00',
    }),
    buildItem({
      description: 'Replacement filters and consumables',
      quantity: '1',
      unit: 'lot',
      unitPrice: '5000.00',
    }),
  ];

  const coolingRequest = await prisma.purchaseRequest.create({
    data: {
      workspaceId: workspace.id,
      requestNumber: 'PR-2026-0146',
      title: 'Data centre cooling maintenance',
      description: 'Quarterly preventative maintenance for the primary and backup cooling loops.',
      status: 'approved',
      priority: 'high',
      category: 'facilities',
      currency: 'USD',
      totalAmount: sumItems(coolingItems),
      department: 'Infrastructure',
      neededBy: daysFromNow(18),
      submittedAt: daysAgo(8, 9),
      decidedAt: daysAgo(5, 15),
      requestedById: people.priya.id,
      items: { create: coolingItems },
    },
    include: { items: true },
  });

  await prisma.approval.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: coolingRequest.id,
      status: 'approved',
      currentStep: 2,
      requestedAt: daysAgo(8, 9),
      completedAt: daysAgo(5, 15),
      steps: {
        create: [
          {
            stepOrder: 1,
            name: 'Operations review',
            approverId: people.amara.id,
            status: 'approved',
            decisionNote: 'Critical maintenance window is already reserved.',
            decidedAt: daysAgo(6, 10),
          },
          {
            stepOrder: 2,
            name: 'Finance review',
            approverId: people.daniel.id,
            status: 'approved',
            decisionNote: 'Approved within the facilities maintenance budget.',
            decidedAt: daysAgo(5, 15),
          },
        ],
      },
    },
  });

  const coolingQuoteItems = [
    buildItem({
      description: 'Precision cooling service visit',
      quantity: '4',
      unit: 'visit',
      unitPrice: '4200.00',
    }),
    buildItem({
      description: 'Replacement filters and consumables',
      quantity: '1',
      unit: 'lot',
      unitPrice: '5000.00',
    }),
  ];

  const coolingSubtotal = sumItems(coolingQuoteItems);
  const coolingTax = coolingSubtotal.mul('0.08');

  const coolingQuote = await prisma.quotation.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: coolingRequest.id,
      vendorId: vendor('VND-004').id,
      quotationNumber: 'QT-2026-0305',
      status: 'selected',
      currency: 'USD',
      subtotal: coolingSubtotal,
      taxAmount: coolingTax,
      totalAmount: coolingSubtotal.add(coolingTax),
      validUntil: daysFromNow(20),
      submittedAt: daysAgo(7, 11),
      notes: 'Includes out-of-hours access and a post-service report.',
      items: {
        create: coolingQuoteItems.map((item, index) => ({
          ...item,
          purchaseRequestItemId: coolingRequest.items[index]?.id,
          leadTimeDays: 10,
        })),
      },
    },
  });

  const coolingOrder = await prisma.purchaseOrder.create({
    data: {
      workspaceId: workspace.id,
      poNumber: 'PO-2026-0093',
      purchaseRequestId: coolingRequest.id,
      vendorId: vendor('VND-004').id,
      quotationId: coolingQuote.id,
      status: 'issued',
      currency: 'USD',
      subtotal: coolingSubtotal,
      taxAmount: coolingTax,
      totalAmount: coolingSubtotal.add(coolingTax),
      issuedAt: daysAgo(4, 9),
      expectedDeliveryDate: daysFromNow(18),
      notes: 'Service window scheduled outside business hours.',
      createdById: people.marcus.id,
      items: {
        create: [
          {
            description: 'Precision cooling service visit',
            quantity: decimal('4'),
            unit: 'visit',
            unitPrice: decimal('4200.00'),
            lineTotal: decimal('16800.00'),
          },
          {
            description: 'Replacement filters and consumables',
            quantity: decimal('1'),
            unit: 'lot',
            unitPrice: decimal('5000.00'),
            lineTotal: decimal('5000.00'),
          },
        ],
      },
    },
  });

  await prisma.delivery.create({
    data: {
      workspaceId: workspace.id,
      purchaseOrderId: coolingOrder.id,
      deliveryNumber: 'DEL-2026-0218',
      status: 'scheduled',
      carrier: 'Verdant Service Team',
      scheduledAt: daysFromNow(18, 19),
      notes: 'Maintenance window confirmed with the facilities team.',
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        workspaceId: workspace.id,
        actorId: people.priya.id,
        action: 'purchase_request.submitted',
        entityType: 'purchase_request',
        entityId: coolingRequest.id,
        summary: 'Submitted PR-2026-0146 for approval.',
        metadata: { requestNumber: 'PR-2026-0146' },
        createdAt: daysAgo(8, 9),
      },
      {
        workspaceId: workspace.id,
        actorId: people.marcus.id,
        action: 'purchase_order.issued',
        entityType: 'purchase_order',
        entityId: coolingOrder.id,
        summary: 'Issued PO-2026-0093 to Verdant Facilities Co.',
        metadata: { poNumber: 'PO-2026-0093' },
        createdAt: daysAgo(4, 9),
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // PR-2026-0129 — approved and fully delivered warehouse consumables.
  // ---------------------------------------------------------------------------
  const packagingItems = [
    buildItem({
      description: 'Heavy-duty corrugated cartons',
      quantity: '2400',
      unit: 'unit',
      unitPrice: '3.10',
    }),
    buildItem({
      description: 'Biodegradable void fill',
      quantity: '180',
      unit: 'bag',
      unitPrice: '22.00',
    }),
    buildItem({
      description: 'Pallet wrap',
      quantity: '96',
      unit: 'roll',
      unitPrice: '15.25',
    }),
  ];

  const packagingRequest = await prisma.purchaseRequest.create({
    data: {
      workspaceId: workspace.id,
      requestNumber: 'PR-2026-0129',
      title: 'Warehouse packaging consumables',
      description: 'Replenish packaging materials ahead of the peak fulfilment period.',
      status: 'approved',
      priority: 'urgent',
      category: 'operations',
      currency: 'USD',
      totalAmount: sumItems(packagingItems),
      department: 'Fulfilment Operations',
      neededBy: daysAgo(2),
      submittedAt: daysAgo(24, 9),
      decidedAt: daysAgo(21, 14),
      requestedById: people.marcus.id,
      items: { create: packagingItems },
    },
    include: { items: true },
  });

  await prisma.approval.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: packagingRequest.id,
      status: 'approved',
      currentStep: 2,
      requestedAt: daysAgo(24, 9),
      completedAt: daysAgo(21, 14),
      steps: {
        create: [
          {
            stepOrder: 1,
            name: 'Operations review',
            approverId: people.amara.id,
            status: 'approved',
            decisionNote: 'Peak volume forecast supports the replenishment.',
            decidedAt: daysAgo(22, 10),
          },
          {
            stepOrder: 2,
            name: 'Finance review',
            approverId: people.daniel.id,
            status: 'approved',
            decisionNote: 'Approved as an operating expense.',
            decidedAt: daysAgo(21, 14),
          },
        ],
      },
    },
  });

  const atlasQuoteItems = [
    buildItem({
      description: 'Heavy-duty corrugated cartons',
      quantity: '2400',
      unit: 'unit',
      unitPrice: '3.10',
    }),
    buildItem({
      description: 'Biodegradable void fill',
      quantity: '180',
      unit: 'bag',
      unitPrice: '22.00',
    }),
    buildItem({
      description: 'Pallet wrap',
      quantity: '96',
      unit: 'roll',
      unitPrice: '15.25',
    }),
  ];

  const atlasSubtotal = sumItems(atlasQuoteItems);
  const atlasTax = atlasSubtotal.mul('0.08');

  const atlasQuote = await prisma.quotation.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: packagingRequest.id,
      vendorId: vendor('VND-002').id,
      quotationNumber: 'QT-2026-0264',
      status: 'selected',
      currency: 'USD',
      subtotal: atlasSubtotal,
      taxAmount: atlasTax,
      totalAmount: atlasSubtotal.add(atlasTax),
      validUntil: daysFromNow(2),
      submittedAt: daysAgo(23, 11),
      notes: 'Includes two scheduled replenishment deliveries.',
      items: {
        create: atlasQuoteItems.map((item, index) => ({
          ...item,
          purchaseRequestItemId: packagingRequest.items[index]?.id,
          leadTimeDays: 5,
        })),
      },
    },
  });

  const cascadeQuoteItems = [
    buildItem({
      description: 'Heavy-duty corrugated cartons',
      quantity: '2400',
      unit: 'unit',
      unitPrice: '3.25',
    }),
    buildItem({
      description: 'Biodegradable void fill',
      quantity: '180',
      unit: 'bag',
      unitPrice: '23.50',
    }),
    buildItem({
      description: 'Pallet wrap',
      quantity: '96',
      unit: 'roll',
      unitPrice: '16.00',
    }),
  ];

  const cascadeSubtotal = sumItems(cascadeQuoteItems);
  const cascadeTax = cascadeSubtotal.mul('0.08');

  await prisma.quotation.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: packagingRequest.id,
      vendorId: vendor('VND-006').id,
      quotationNumber: 'QT-2026-0265',
      status: 'rejected',
      currency: 'USD',
      subtotal: cascadeSubtotal,
      taxAmount: cascadeTax,
      totalAmount: cascadeSubtotal.add(cascadeTax),
      validUntil: daysFromNow(5),
      submittedAt: daysAgo(23, 15),
      notes: 'Higher unit pricing with a shorter lead time.',
      items: {
        create: cascadeQuoteItems.map((item, index) => ({
          ...item,
          purchaseRequestItemId: packagingRequest.items[index]?.id,
          leadTimeDays: 3,
        })),
      },
    },
  });

  const packagingOrder = await prisma.purchaseOrder.create({
    data: {
      workspaceId: workspace.id,
      poNumber: 'PO-2026-0081',
      purchaseRequestId: packagingRequest.id,
      vendorId: vendor('VND-002').id,
      quotationId: atlasQuote.id,
      status: 'delivered',
      currency: 'USD',
      subtotal: atlasSubtotal,
      taxAmount: atlasTax,
      totalAmount: atlasSubtotal.add(atlasTax),
      issuedAt: daysAgo(20, 10),
      expectedDeliveryDate: daysAgo(5),
      deliveredAt: daysAgo(4, 13),
      notes: 'Delivered in full to the Portland fulfilment centre.',
      createdById: people.marcus.id,
      items: {
        create: [
          {
            description: 'Heavy-duty corrugated cartons',
            quantity: decimal('2400'),
            unit: 'unit',
            unitPrice: decimal('3.10'),
            lineTotal: decimal('7440.00'),
            receivedQuantity: decimal('2400'),
          },
          {
            description: 'Biodegradable void fill',
            quantity: decimal('180'),
            unit: 'bag',
            unitPrice: decimal('22.00'),
            lineTotal: decimal('3960.00'),
            receivedQuantity: decimal('180'),
          },
          {
            description: 'Pallet wrap',
            quantity: decimal('96'),
            unit: 'roll',
            unitPrice: decimal('15.25'),
            lineTotal: decimal('1464.00'),
            receivedQuantity: decimal('96'),
          },
        ],
      },
    },
  });

  await prisma.delivery.create({
    data: {
      workspaceId: workspace.id,
      purchaseOrderId: packagingOrder.id,
      deliveryNumber: 'DEL-2026-0188',
      status: 'delivered',
      carrier: 'Atlas Fleet',
      trackingNumber: 'ATL-7712-440',
      scheduledAt: daysAgo(5, 9),
      deliveredAt: daysAgo(4, 13),
      receivedById: people.marcus.id,
      notes: 'All cartons, void fill and pallet wrap received in good condition.',
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        workspaceId: workspace.id,
        actorId: people.marcus.id,
        action: 'purchase_request.submitted',
        entityType: 'purchase_request',
        entityId: packagingRequest.id,
        summary: 'Submitted PR-2026-0129 for approval.',
        metadata: { requestNumber: 'PR-2026-0129' },
        createdAt: daysAgo(24, 9),
      },
      {
        workspaceId: workspace.id,
        actorId: people.daniel.id,
        action: 'approval.completed',
        entityType: 'purchase_request',
        entityId: packagingRequest.id,
        summary: 'Approved PR-2026-0129 after finance review.',
        metadata: { requestNumber: 'PR-2026-0129' },
        createdAt: daysAgo(21, 14),
      },
      {
        workspaceId: workspace.id,
        actorId: people.marcus.id,
        action: 'purchase_order.issued',
        entityType: 'purchase_order',
        entityId: packagingOrder.id,
        summary: 'Issued PO-2026-0081 to Atlas Industrial Supply.',
        metadata: { poNumber: 'PO-2026-0081' },
        createdAt: daysAgo(20, 10),
      },
      {
        workspaceId: workspace.id,
        actorId: people.marcus.id,
        action: 'delivery.received',
        entityType: 'delivery',
        entityId: packagingOrder.id,
        summary: 'Received PO-2026-0081 in full at the Portland fulfilment centre.',
        metadata: { deliveryNumber: 'DEL-2026-0188' },
        createdAt: daysAgo(4, 13),
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // PR-2026-0133 — rejected security training platform.
  // ---------------------------------------------------------------------------
  const trainingItems = [
    buildItem({
      description: 'Security awareness platform licence',
      quantity: '350',
      unit: 'seat',
      unitPrice: '45.00',
    }),
    buildItem({
      description: 'Onboarding content package',
      quantity: '1',
      unit: 'package',
      unitPrice: '2750.00',
    }),
  ];

  const trainingRequest = await prisma.purchaseRequest.create({
    data: {
      workspaceId: workspace.id,
      requestNumber: 'PR-2026-0133',
      title: 'Annual security awareness platform',
      description: 'Consolidated security awareness training and phishing simulation platform.',
      status: 'rejected',
      priority: 'medium',
      category: 'professional_services',
      currency: 'USD',
      totalAmount: sumItems(trainingItems),
      department: 'Compliance',
      neededBy: daysFromNow(30),
      submittedAt: daysAgo(18, 9),
      decidedAt: daysAgo(14, 15),
      requestedById: people.sofia.id,
      items: { create: trainingItems },
    },
    include: { items: true },
  });

  await prisma.approval.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: trainingRequest.id,
      status: 'rejected',
      currentStep: 2,
      requestedAt: daysAgo(18, 9),
      completedAt: daysAgo(14, 15),
      steps: {
        create: [
          {
            stepOrder: 1,
            name: 'Compliance review',
            approverId: people.amara.id,
            status: 'approved',
            decisionNote: 'The capability gap is valid; commercial review required.',
            decidedAt: daysAgo(16, 11),
          },
          {
            stepOrder: 2,
            name: 'Finance review',
            approverId: people.daniel.id,
            status: 'rejected',
            decisionNote: 'Consolidate with the existing learning contract before renewing.',
            decidedAt: daysAgo(14, 15),
          },
        ],
      },
    },
  });

  const trainingQuoteItems = [
    buildItem({
      description: 'Security awareness platform licence',
      quantity: '350',
      unit: 'seat',
      unitPrice: '45.00',
    }),
    buildItem({
      description: 'Onboarding content package',
      quantity: '1',
      unit: 'package',
      unitPrice: '2750.00',
    }),
  ];

  const trainingSubtotal = sumItems(trainingQuoteItems);

  await prisma.quotation.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: trainingRequest.id,
      vendorId: vendor('VND-007').id,
      quotationNumber: 'QT-2026-0281',
      status: 'rejected',
      currency: 'USD',
      subtotal: trainingSubtotal,
      taxAmount: decimal(0),
      totalAmount: trainingSubtotal,
      validUntil: daysFromNow(14),
      submittedAt: daysAgo(17, 14),
      notes: 'Professional services are exempt from sales tax in this scenario.',
      items: {
        create: trainingQuoteItems.map((item, index) => ({
          ...item,
          purchaseRequestItemId: trainingRequest.items[index]?.id,
          leadTimeDays: 7,
        })),
      },
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        workspaceId: workspace.id,
        actorId: people.sofia.id,
        action: 'purchase_request.submitted',
        entityType: 'purchase_request',
        entityId: trainingRequest.id,
        summary: 'Submitted PR-2026-0133 for approval.',
        metadata: { requestNumber: 'PR-2026-0133' },
        createdAt: daysAgo(18, 9),
      },
      {
        workspaceId: workspace.id,
        actorId: people.daniel.id,
        action: 'approval.rejected',
        entityType: 'purchase_request',
        entityId: trainingRequest.id,
        summary: 'Rejected PR-2026-0133 pending contract consolidation.',
        metadata: { requestNumber: 'PR-2026-0133' },
        createdAt: daysAgo(14, 15),
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // PR-2026-0151 — draft marketing retainer, no approval or quotes yet.
  // ---------------------------------------------------------------------------
  const marketingItems = [
    buildItem({
      description: 'Brand campaign strategy',
      quantity: '1',
      unit: 'engagement',
      unitPrice: '12000.00',
    }),
    buildItem({
      description: 'Content production retainer',
      quantity: '3',
      unit: 'month',
      unitPrice: '6000.00',
    }),
  ];

  const marketingRequest = await prisma.purchaseRequest.create({
    data: {
      workspaceId: workspace.id,
      requestNumber: 'PR-2026-0151',
      title: 'Marketing agency retainer — Q1',
      description:
        'Retainer for campaign strategy and content production through the first quarter.',
      status: 'draft',
      priority: 'medium',
      category: 'marketing',
      currency: 'USD',
      totalAmount: sumItems(marketingItems),
      department: 'Brand Marketing',
      neededBy: daysFromNow(45),
      requestedById: people.sofia.id,
      items: { create: marketingItems },
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorId: people.sofia.id,
      action: 'purchase_request.created',
      entityType: 'purchase_request',
      entityId: marketingRequest.id,
      summary: 'Created draft PR-2026-0151.',
      metadata: { requestNumber: 'PR-2026-0151' },
      createdAt: daysAgo(1, 16),
    },
  });

  // ---------------------------------------------------------------------------
  // PR-2026-0121 — cancelled fleet telematics renewal.
  // ---------------------------------------------------------------------------
  const telematicsItems = [
    buildItem({
      description: 'Fleet telematics subscription',
      quantity: '48',
      unit: 'vehicle',
      unitPrice: '200.00',
    }),
  ];

  const telematicsRequest = await prisma.purchaseRequest.create({
    data: {
      workspaceId: workspace.id,
      requestNumber: 'PR-2026-0121',
      title: 'Fleet telematics renewal',
      description: 'Annual renewal of vehicle telematics for the regional fleet.',
      status: 'cancelled',
      priority: 'low',
      category: 'logistics',
      currency: 'USD',
      totalAmount: sumItems(telematicsItems),
      department: 'Fleet Operations',
      neededBy: daysFromNow(8),
      submittedAt: daysAgo(35, 9),
      decidedAt: daysAgo(30, 10),
      requestedById: people.marcus.id,
      items: { create: telematicsItems },
    },
  });

  await prisma.approval.create({
    data: {
      workspaceId: workspace.id,
      purchaseRequestId: telematicsRequest.id,
      status: 'rejected',
      currentStep: 1,
      requestedAt: daysAgo(35, 9),
      completedAt: daysAgo(30, 10),
      steps: {
        create: [
          {
            stepOrder: 1,
            name: 'Fleet review',
            approverId: people.amara.id,
            status: 'rejected',
            decisionNote: 'Request withdrawn; the incumbent contract was extended instead.',
            decidedAt: daysAgo(30, 10),
          },
        ],
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorId: people.amara.id,
      action: 'purchase_request.cancelled',
      entityType: 'purchase_request',
      entityId: telematicsRequest.id,
      summary: 'Cancelled PR-2026-0121 after extending the incumbent contract.',
      metadata: { requestNumber: 'PR-2026-0121' },
      createdAt: daysAgo(30, 10),
    },
  });

  // A small vendor onboarding trail completes the activity surface.
  await prisma.auditLog.createMany({
    data: [
      {
        workspaceId: workspace.id,
        actorId: people.amara.id,
        action: 'vendor.onboarded',
        entityType: 'vendor',
        entityId: vendor('VND-007').id,
        summary: 'Started onboarding for Cedar & Co. Professional Services.',
        metadata: { vendorCode: 'VND-007' },
        createdAt: daysAgo(12, 11),
      },
      {
        workspaceId: workspace.id,
        actorId: people.amara.id,
        action: 'workspace.created',
        entityType: 'workspace',
        entityId: workspace.id,
        summary: 'Created the Northwind Industrial procurement workspace.',
        metadata: { slug: WORKSPACE_SLUG },
        createdAt: daysAgo(420, 9),
      },
    ],
  });

  console.log(
    `[procureflow:seed] Seeded ${workspace.name} with ${vendors.size} vendors, 7 purchase requests, 8 quotations, 3 purchase orders and 4 deliveries.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('[procureflow:seed] Failed to seed the database.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
