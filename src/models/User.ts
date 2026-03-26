import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// User attributes interface
export interface UserAttributes {
  id: number;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'user' | 'readonly';
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  failedLoginAttempts: number;
  accountLockedUntil?: Date;
  lastLoginAt?: Date;
  lastPasswordChangeAt: Date;
  passwordHistory: string[]; // Store last 5 password hashes
  createdAt: Date;
  updatedAt: Date;
}

// Optional attributes for creation
export interface UserCreationAttributes extends Optional<UserAttributes, 
  'id' | 'isActive' | 'isEmailVerified' | 'failedLoginAttempts' | 'passwordHistory' | 
  'createdAt' | 'updatedAt' | 'lastPasswordChangeAt'> {}

// User model class
export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public email!: string;
  public passwordHash!: string;
  public firstName!: string;
  public lastName!: string;
  public role!: 'admin' | 'manager' | 'user' | 'readonly';
  public isActive!: boolean;
  public isEmailVerified!: boolean;
  public emailVerificationToken?: string;
  public passwordResetToken?: string;
  public passwordResetExpires?: Date;
  public failedLoginAttempts!: number;
  public accountLockedUntil?: Date;
  public lastLoginAt?: Date;
  public lastPasswordChangeAt!: Date;
  public passwordHistory!: string[];
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  public get isAccountLocked(): boolean {
    return this.accountLockedUntil ? this.accountLockedUntil > new Date() : false;
  }

  public incrementFailedAttempts(): void {
    this.failedLoginAttempts += 1;
    
    // Lock account after 5 failed attempts for 30 minutes
    if (this.failedLoginAttempts >= 5) {
      this.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
  }

  public resetFailedAttempts(): void {
    this.failedLoginAttempts = 0;
    this.accountLockedUntil = undefined;
  }

  public addPasswordToHistory(passwordHash: string): void {
    this.passwordHistory = this.passwordHistory || [];
    this.passwordHistory.unshift(passwordHash);
    
    // Keep only last 5 passwords
    if (this.passwordHistory.length > 5) {
      this.passwordHistory = this.passwordHistory.slice(0, 5);
    }
  }
}

// Initialize the model
User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash', // Map to snake_case column
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'first_name', // Map to snake_case column
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'last_name', // Map to snake_case column
    },
    role: {
      type: DataTypes.ENUM('admin', 'manager', 'user', 'readonly'),
      allowNull: false,
      defaultValue: 'user',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true, // Require activation
      field: 'is_active', // Map to snake_case column
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_email_verified', // Map to snake_case column
    },
    emailVerificationToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'email_verification_token', // Map to snake_case column
    },
    passwordResetToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'password_reset_token', // Map to snake_case column
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'password_reset_expires', // Map to snake_case column
    },
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'failed_login_attempts', // Map to snake_case column
    },
    accountLockedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'account_locked_until', // Map to snake_case column
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at', // Map to snake_case column
    },
    lastPasswordChangeAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_password_change_at', // Map to snake_case column
    },
    passwordHistory: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      field: 'password_history', // Map to snake_case column
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at', // Map to snake_case column
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at', // Map to snake_case column
    },
  },
  {
    sequelize,
    tableName: 'auth_users',
    modelName: 'User',
    timestamps: true,
    indexes: [
      {
        fields: ['email'],
        unique: true,
      },
      {
        fields: ['email_verification_token'], // Use snake_case column name
      },
      {
        fields: ['password_reset_token'], // Use snake_case column name
      },
      {
        fields: ['role'],
      },
      {
        fields: ['is_active'], // Use snake_case column name
      },
    ],
  }
);

export default User;