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

- **Advanced Features**
  - Credit card payment flow with accounts receivable
  - Associated invoices for freight cost allocation
  - Automatic inventory updates
  - Sequential registration numbers

- **Comprehensive Reports**
  - PPE tracking with depreciation schedules
  - Investment portfolio with ROI analysis
  - Inventory movement reports
  - Accounts payable/receivable tracking
  - Cash flow reports

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
│   │   └── ...
│   ├── controllers/             # Request handlers
│   │   ├── productController.ts
│   │   ├── purchaseController.ts
│   │   ├── reportController.ts
│   │   └── ...
│   ├── services/                # Business logic
│   │   ├── productService.ts
│   │   ├── purchaseService.ts
│   │   ├── reportService.ts
│   │   └── ...
│   ├── routes/                  # API routes
│   │   ├── productRoutes.ts
│   │   ├── purchaseRoutes.ts
│   │   ├── reportRoutes.ts
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
