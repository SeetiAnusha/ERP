# ERP System - Backend API

Enterprise Resource Planning (ERP) system backend built with Node.js, Express, TypeScript, and PostgreSQL.

## 🚀 Features

- **Master Data Management**
  - Products, Suppliers, Customers
  - Fixed Assets (PPE) with depreciation tracking
  - Investments portfolio management
  - Prepaid expenses tracking

- **Transaction Management**
  - Purchase recording (RC####)
  - Sales recording (RV####)
  - Payment processing (PG####)
  - Adjustments (ND####, NC####, AJ####)
  - Cash register (CJ####)

- **Business Expense Management**
  - Comprehensive expense tracking with dual recording
  - Bank payment validation (balance checking)
  - Credit payment integration with Accounts Payable
  - Automatic AP entry creation for credit expenses
  - Real-time payment synchronization across modules

- **Accounts Payable System**
  - Supplier invoice management
  - Payment processing with multiple methods
  - Bank register integration for payments
  - Business expense synchronization
  - Credit balance application

- **Bank Register Management**
  - Multi-bank account support
  - Opening balance configuration
  - Payment processing for AP invoices
  - Balance validation and tracking
  - Transaction history with detailed logging

- **Customer Credit Management**
  - Credit balance tracking and application
  - Overpayment handling with automatic credit creation
  - Credit-aware payment processing
  - Intelligent payment method selection
  - Credit balance reduction and usage tracking

- **Advanced Features**
  - Credit card payment flow with accounts receivable
  - Associated invoices for freight cost allocation
  - Automatic inventory updates
  - Sequential registration numbers
  - Dual recording system (Bank + Expense, Credit + AP)
  - Real-time balance validation
  - Cross-module payment synchronization

- **Comprehensive Reports**
  - PPE tracking with depreciation schedules
  - Investment portfolio with ROI analysis
  - Inventory movement reports
  - Accounts payable/receivable tracking
  - Cash flow reports
  - Business expense analytics
  - Credit balance utilization reports

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/erp-backend.git
cd erp-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

Required environment variables:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=erp_database
DB_USER=postgres
DB_PASSWORD=your_password

# Server Configuration
PORT=5000
NODE_ENV=development
```

### 4. Setup database

```bash
# Create PostgreSQL database
createdb erp_database

# Or using psql
psql -U postgres
CREATE DATABASE erp_database;
\q
```

### 5. Run the application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
# Build TypeScript
npm run build

# Start server
npm start
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts          # Database configuration
│   ├── models/                  # Sequelize models
│   │   ├── Product.ts
│   │   ├── Purchase.ts
│   │   ├── Sale.ts
│   │   ├── FixedAsset.ts
│   │   ├── Investment.ts
│   │   ├── BusinessExpense.ts   # Business expense tracking
│   │   ├── AccountsPayable.ts   # AP management
│   │   ├── BankRegister.ts      # Bank transactions
│   │   ├── CreditBalance.ts     # Customer credit tracking
│   │   └── ...
│   ├── controllers/             # Request handlers
│   │   ├── productController.ts
│   │   ├── purchaseController.ts
│   │   ├── reportController.ts
│   │   ├── businessExpenseController.ts
│   │   ├── accountsPayableController.ts
│   │   ├── bankRegisterController.ts
│   │   ├── creditBalanceController.ts
│   │   └── ...
│   ├── services/                # Business logic
│   │   ├── productService.ts
│   │   ├── purchaseService.ts
│   │   ├── reportService.ts
│   │   ├── businessExpenseService.ts
│   │   ├── accountsPayableService.ts
│   │   ├── bankRegisterService.ts
│   │   ├── creditBalanceService.ts
│   │   ├── customerCreditAwarePaymentService.ts
│   │   ├── cashRegisterService.ts
│   │   └── ...
│   ├── routes/                  # API routes
│   │   ├── productRoutes.ts
│   │   ├── purchaseRoutes.ts
│   │   ├── reportRoutes.ts
│   │   ├── businessExpenseRoutes.ts
│   │   ├── accountsPayableRoutes.ts
│   │   ├── bankRegisterRoutes.ts
│   │   ├── creditBalanceRoutes.ts
│   │   └── ...
│   └── index.ts                 # Application entry point
├── dist/                        # Compiled JavaScript (gitignored)
├── node_modules/                # Dependencies (gitignored)
├── .env                         # Environment variables (gitignored)
├── .env.example                 # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 🔌 API Endpoints

### Master Data

#### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

#### Suppliers
- `GET /api/suppliers` - Get all suppliers
- `POST /api/suppliers` - Create supplier
- `PUT /api/suppliers/:id` - Update supplier
- `DELETE /api/suppliers/:id` - Delete supplier

#### Clients
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Create client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

#### Fixed Assets
- `GET /api/fixed-assets` - Get all fixed assets
- `POST /api/fixed-assets` - Create fixed asset
- `PUT /api/fixed-assets/:id` - Update fixed asset
- `DELETE /api/fixed-assets/:id` - Delete fixed asset

#### Investments
- `GET /api/investments` - Get all investments
- `POST /api/investments` - Create investment
- `PUT /api/investments/:id` - Update investment
- `DELETE /api/investments/:id` - Delete investment

#### Prepaid Expenses
- `GET /api/prepaid-expenses` - Get all prepaid expenses
- `POST /api/prepaid-expenses` - Create prepaid expense
- `PUT /api/prepaid-expenses/:id` - Update prepaid expense
- `DELETE /api/prepaid-expenses/:id` - Delete prepaid expense
- `GET /api/business-expenses` - Get all business expenses
- `GET /api/business-expenses/:id` - Get expense by ID
- `POST /api/business-expenses` - Create business expense
- `PUT /api/business-expenses/:id` - Update business expense
- `DELETE /api/business-expenses/:id` - Delete business expense
- `GET /api/business-expenses/dashboard` - Get expense dashboard data

### Accounts Payable
- `GET /api/accounts-payable` - Get all AP entries
- `GET /api/accounts-payable/:id` - Get AP entry by ID
- `POST /api/accounts-payable` - Create AP entry
- `PUT /api/accounts-payable/:id` - Update AP entry
- `DELETE /api/accounts-payable/:id` - Delete AP entry
- `POST /api/accounts-payable/:id/pay` - Process AP payment

### Bank Register
- `GET /api/bank-register` - Get all bank transactions
- `GET /api/bank-register/accounts` - Get all bank accounts
- `POST /api/bank-register/accounts` - Create bank account
- `GET /api/bank-register/pending-invoices` - Get pending AP invoices
- `POST /api/bank-register/pay-invoices` - Pay multiple invoices
- `GET /api/bank-register/balance/:accountId` - Get account balance

### Credit Balance Management
- `GET /api/credit-balance` - Get all credit balances
- `GET /api/credit-balance/:id` - Get credit balance by ID
- `POST /api/credit-balance` - Create credit balance
- `PUT /api/credit-balance/:id` - Update credit balance
- `DELETE /api/credit-balance/:id` - Delete credit balance
- `GET /api/credit-balance/entity/:type/:id` - Get credit balances by entity
- `POST /api/credit-balance/apply` - Apply credit to invoices

### Customer Credit Aware Payments
- `POST /api/customer-credit-aware-payment/process` - Process credit-aware payment
- `POST /api/customer-credit-aware-payment/preview` - Get payment preview

### Transactions

#### Purchases (RC####)
- `GET /api/purchases` - Get all purchases
- `GET /api/purchases/:id` - Get purchase by ID
- `POST /api/purchases` - Create purchase
- `PUT /api/purchases/:id` - Update purchase
- `DELETE /api/purchases/:id` - Delete purchase

#### Sales (RV####)
- `GET /api/sales` - Get all sales
- `GET /api/sales/:id` - Get sale by ID
- `POST /api/sales` - Create sale
- `PUT /api/sales/:id` - Update sale
- `DELETE /api/sales/:id` - Delete sale

#### Payments (PG####)
- `GET /api/payments` - Get all payments
- `POST /api/payments` - Create payment
- `DELETE /api/payments/:id` - Delete payment

#### Adjustments (ND####, NC####, AJ####)
- `GET /api/adjustments` - Get all adjustments
- `POST /api/adjustments` - Create adjustment
- `DELETE /api/adjustments/:id` - Delete adjustment

#### Cash Register (CJ####)
- `GET /api/cash-register` - Get all transactions
- `POST /api/cash-register` - Create transaction
- `GET /api/cash-register/balance` - Get current balance

### Reports

- `GET /api/reports/ppe-tracking` - PPE tracking report
  - Query params: `?category=Buildings`
  
- `GET /api/reports/depreciation-schedule/:id` - Depreciation schedule for asset
  
- `GET /api/reports/investment-tracking` - Investment portfolio report
  - Query params: `?type=Stocks`
  
- `GET /api/reports/prepaid-expenses` - Prepaid expenses report
  - Query params: `?type=Insurance`
  
- `GET /api/reports/inventory-movement` - Inventory movement report
  - Query params: `?startDate=2024-01-01&endDate=2024-12-31&productId=5`

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | erp_database |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | - |
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment | development |

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run tests with coverage
npm run test:coverage
```

## 📦 Building for Production

```bash
# Build TypeScript to JavaScript
npm run build

# Output will be in dist/ folder
```

## 🚀 Deployment

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Build the project
npm run build

# Start with PM2
pm2 start dist/index.js --name "erp-backend"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t erp-backend .
docker run -p 5000:5000 --env-file .env erp-backend
```

## 🔧 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm test` | Run tests |

## 🛡️ Security

- Environment variables for sensitive data
- CORS configuration
- Input validation
- SQL injection prevention (Sequelize ORM)
- Password hashing (if implementing authentication)

## 📝 Database Schema

### Key Models

- **Product** - Product master data
- **Supplier** - Supplier information
- **Client** - Customer information
- **Purchase** - Purchase transactions (RC####)
- **PurchaseItem** - Purchase line items
- **Sale** - Sales transactions (RV####)
- **SaleItem** - Sales line items
- **Payment** - Payment records (PG####)
- **Adjustment** - Adjustments (ND####, NC####, AJ####)
- **CashRegister** - Cash movements (CJ####)
- **FixedAsset** - Property, plant & equipment
- **Investment** - Investment portfolio
- **BusinessExpense** - Business expense tracking
- **AccountsPayable** - Accounts payable management
- **BankRegister** - Bank transaction records
- **CreditBalance** - Customer credit balance tracking
- **PrepaidExpense** - Prepaid expenses tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Authors

- Your Name - Initial work

## 🙏 Acknowledgments

- Express.js for the web framework
- Sequelize for ORM
- TypeScript for type safety
- PostgreSQL for the database

## 📞 Support

For support, email support@yourcompany.com or open an issue in the repository.

## 🔄 Version History

- **2.0.0** (2026-03-21)
  - **Major Business Expense Management System**
    - Comprehensive payment validation and dual recording
    - Bank payment validation with balance checking
    - Credit payment integration with Accounts Payable
    - Automatic AP entry creation for credit expenses
  - **Enhanced Accounts Payable System**
    - Multi-payment method support
    - Bank register integration
    - Business expense synchronization
    - Real-time payment status updates
  - **Advanced Bank Register Management**
    - Multi-bank account support with opening balances
    - Payment processing for AP invoices
    - Balance validation and transaction tracking
    - Cross-module payment synchronization
  - **Customer Credit Management System**
    - Credit balance tracking and application
    - Overpayment handling with automatic credit creation
    - Credit-aware payment processing
    - Intelligent payment method selection
  - **Cash Register Enhancements**
    - Credit balance integration
    - Duplicate credit balance prevention
    - Enhanced transaction recording
    - Improved error handling

- **1.0.0** (2024-01-18)
  - Initial release
  - Master data management
  - Transaction recording
  - Report generation
  - Credit card payment flow
  - PPE tracking with depreciation
  - Investment portfolio tracking

## 🗺️ Roadmap

- [ ] User authentication and authorization
- [ ] Role-based access control
- [ ] Email notifications
- [ ] PDF report generation
- [ ] Excel export functionality
- [ ] Audit logging
- [ ] Multi-currency support
- [ ] Multi-language support
- [ ] Advanced credit balance analytics
- [ ] Automated payment reminders
- [ ] Bank reconciliation module
- [ ] Advanced reporting dashboard
- [ ] Mobile API endpoints
- [ ] Webhook integrations
