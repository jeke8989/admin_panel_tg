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

interface UserToCreate {
  email: string;
  password: string;
  role: AdminRole;
}

const usersToCreate: UserToCreate[] = [
  {
    email: 'user1@telegram.local',
    password: 'User1_2025!',
    role: 'user',
  },
  {
    email: 'user2@telegram.local',
    password: 'User2_2025!',
    role: 'user',
  },
  {
    email: 'user3@telegram.local',
    password: 'User3_2025!',
    role: 'user',
  },
];

async function createUsers() {
  await AppDataSource.initialize();
  console.log('✅ Подключение к базе данных установлено\n');

  const adminRepo = AppDataSource.getRepository(Admin);

  console.log('📋 Создание пользователей с ролью "user":\n');
  console.log('='.repeat(60));

  const createdUsers: Array<{ email: string; password: string }> = [];

  for (const u of usersToCreate) {
    const existing = await adminRepo.findOne({ where: { email: u.email } });
    if (existing) {
      console.log(`⚠️  Пропущен: ${u.email} – уже существует`);
      continue;
    }

    const hashed = await bcrypt.hash(u.password, 10);
    const admin = adminRepo.create({
      email: u.email,
      password: hashed,
      role: u.role,
    });
    await adminRepo.save(admin);
    
    createdUsers.push({ email: u.email, password: u.password });
    console.log(`✅ Создан: ${u.email}`);
  }

  await AppDataSource.destroy();

  console.log('\n' + '='.repeat(60));
  console.log('\n📝 Данные для входа:\n');
  
  createdUsers.forEach((user, index) => {
    console.log(`Пользователь ${index + 1}:`);
    console.log(`  📧 Логин: ${user.email}`);
    console.log(`  🔑 Пароль: ${user.password}`);
    console.log('');
  });

  console.log('✅ Готово!');
}

createUsers()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Ошибка при создании пользователей:', err);
    process.exit(1);
  });

