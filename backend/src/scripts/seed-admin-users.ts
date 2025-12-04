import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { databaseConfig } from '../config/database.config';
import { Admin, AdminRole } from '../entities/Admin.entity';

const AppDataSource = new DataSource({
  ...(databaseConfig as any),
  entities: [Admin],
  synchronize: false,
});

interface SeedUser {
  email: string;
  password: string;
  role: AdminRole;
}

const usersToCreate: SeedUser[] = [
  {
    email: 'admin@yourapp.local',
    password: 'Admin_2025_Strong!',
    role: 'admin',
  },
  {
    email: 'user1@yourapp.local',
    password: 'User1_2025_Strong!',
    role: 'user',
  },
  {
    email: 'user2@yourapp.local',
    password: 'User2_2025_Strong!',
    role: 'user',
  },
  {
    email: 'user3@yourapp.local',
    password: 'User3_2025_Strong!',
    role: 'user',
  },
];

async function seed() {
  await AppDataSource.initialize();

  const adminRepo = AppDataSource.getRepository(Admin);

  for (const u of usersToCreate) {
    const existing = await adminRepo.findOne({ where: { email: u.email } });
    if (existing) {
      console.log(`Skip ${u.email} – already exists`);
      continue;
    }

    const hashed = await bcrypt.hash(u.password, 10);
    const admin = adminRepo.create({
      email: u.email,
      password: hashed,
      role: u.role,
    });
    await adminRepo.save(admin);
    console.log(`Created ${u.role} ${u.email}`);
  }

  await AppDataSource.destroy();
}

seed()
  .then(() => {
    console.log('Seeding completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seeding error', err);
    process.exit(1);
  });


