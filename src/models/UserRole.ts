import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

interface UserRoleAttributes {
  id: number;
  user_id: number;
  role_name: 'Staff' | 'Manager' | 'Controller' | 'CFO' | 'Board';
  approval_limit: number;
  can_delegate: boolean;
  is_active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserRoleCreationAttributes extends Optional<UserRoleAttributes, 'id'> {}

class UserRole extends Model<UserRoleAttributes, UserRoleCreationAttributes> implements UserRoleAttributes {
  public id!: number;
  public user_id!: number;
  public role_name!: 'Staff' | 'Manager' | 'Controller' | 'CFO' | 'Board';
  public approval_limit!: number;
  public can_delegate!: boolean;
  public is_active!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public user?: any;
}

UserRole.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    role_name: {
      type: DataTypes.ENUM('Staff', 'Manager', 'Controller', 'CFO', 'Board'),
      allowNull: false,
    },
    approval_limit: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    can_delegate: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'UserRole',
    tableName: 'user_roles',
    timestamps: true,
    underscored: true,
  }
);

export default UserRole;