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
}

