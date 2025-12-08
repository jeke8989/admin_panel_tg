import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Admin } from '../entities/Admin.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    try {
      const existingAdmin = await this.adminRepository.findOne({
        where: { email: registerDto.email },
      });

      if (existingAdmin) {
        throw new ConflictException('Админ с таким email уже существует');
      }

      const hashedPassword = await bcrypt.hash(registerDto.password, 10);

      const admin = this.adminRepository.create({
        email: registerDto.email,
        password: hashedPassword,
      });

      const savedAdmin = await this.adminRepository.save(admin);

      const payload = { email: savedAdmin.email, sub: savedAdmin.id, role: savedAdmin.role };
      const accessToken = this.jwtService.sign(payload);

      return {
        accessToken,
        admin: {
          id: savedAdmin.id,
          email: savedAdmin.email,
          role: savedAdmin.role,
        },
      };
    } catch (error) {
      // Если это уже NestJS исключение, пробрасываем его дальше
      if (error instanceof ConflictException) {
        throw error;
      }
      // Иначе оборачиваем в общее исключение
      console.error('Registration error:', error);
      throw new ConflictException('Ошибка при регистрации. Попробуйте позже.');
    }
  }

  async login(loginDto: LoginDto) {
    const admin = await this.adminRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!admin) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      admin.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const payload = { email: admin.email, sub: admin.id, role: admin.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  async seed() {
    console.log('Seeding data...');

    const seedData = [];
    const passwords: Record<string, string> = {};

    // Create admin user
    const adminEmail = 'admin@test.com';
    const adminPassword = 'Admin123!';
    passwords[adminEmail] = adminPassword;
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

    const existingAdmin = await this.adminRepository.findOne({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const admin = this.adminRepository.create({
        email: adminEmail,
        password: hashedAdminPassword,
        role: 'admin',
      });
      const savedAdmin = await this.adminRepository.save(admin);
      seedData.push({ email: adminEmail, role: 'admin', id: savedAdmin.id, password: adminPassword });
    } else {
      seedData.push({ email: adminEmail, role: 'admin', id: existingAdmin.id, status: 'already exists', password: adminPassword });
    }

    // Create 3 regular users with unique passwords
    const users = [
      { email: 'user1@test.com', password: 'User1Pass123!aa' },
      { email: 'user2@test.com', password: 'User2Pass123!bb' },
      { email: 'user3@test.com', password: 'User3Pass123!cc' },
    ];

    for (const { email, password } of users) {
      passwords[email] = password;
      const hashedPassword = await bcrypt.hash(password, 10);

      const existing = await this.adminRepository.findOne({
        where: { email },
      });

      if (!existing) {
        const user = this.adminRepository.create({
          email,
          password: hashedPassword,
          role: 'user',
        });
        const savedUser = await this.adminRepository.save(user);
        seedData.push({ email, role: 'user', id: savedUser.id, password });
      } else {
        seedData.push({ email, role: 'user', id: existing.id, status: 'already exists', password });
      }
    }

    return {
      message: 'Пользователи успешно добавлены/проверены',
      data: seedData,
      passwords,
    };
  }
}

