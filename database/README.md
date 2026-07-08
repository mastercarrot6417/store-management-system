# My Dream Bike Store Management System

## Project Overview

My Dream Bike Store Management System is a web-based inventory and product management system developed for a motorcycle gear store. The system allows administrators to manage products, colours, images, stock quantity, stock movement records, and customer accounts. Customers can browse products, view product details, select product colours and sizes, and log in using a normal account or Google account.

The system focuses on managing motorcycle-related products such as helmets, riding apparel, and accessories. It also includes a stock control workflow where inventory quantity is managed through Stock In and Stock Out functions instead of directly editing product quantity.

## Main Features

### Customer Side

* View homepage product sections
* Browse products by category and subcategory
* View product details
* Select product colour and size
* Show disabled size buttons when stock is unavailable
* Display out-of-stock status clearly
* Customer login and sign up
* Google customer login
* User account page
* Mobile-friendly navigation menu
* Legal pages:

  * Cookie Notice
  * Privacy Policy
  * Terms & Conditions
* Google Maps store location section

### Admin Side

* Admin dashboard with inventory summary
* Manage products
* Add and edit product details
* Manage product colours and images
* Set main product image
* Stock In function
* Stock Out function
* Stock Movement History
* Stock Report with filters
* Export stock report as CSV
* Print stock report
* Low stock and out-of-stock tracking
* Boss-only stock value visibility
* Custom confirmation modals for important actions
* CSRF protection for admin forms

## Inventory Workflow

The system uses a colour and size based inventory structure:

```text
Product + Colour + Size = Quantity
```

Example:

| Product  | Colour | Size | Quantity |
| -------- | ------ | ---- | -------- |
| Helmet A | Black  | M    | 5        |
| Helmet A | Red    | M    | 0        |
| Helmet A | Black  | XL   | 2        |

Administrators cannot directly edit stock quantity from the product edit page. Instead, stock must be updated using:

* **Stock In**: Add stock with reason and note
* **Stock Out**: Remove stock with reason and note

All stock changes are recorded in Stock Movement History for tracking and auditing.

## Technologies Used

* PHP
* PostgreSQL
* Supabase
* HTML
* CSS
* JavaScript
* Google OAuth
* Google Maps API
* Apache / XAMPP for local development

## Project Structure

```text
store_management/
│
├── admin/                  # Admin dashboard and management pages
├── assets/                 # CSS, JavaScript, and public assets
├── company_logo/           # Company logo and brand images
├── config/                 # Database, Google, Maps, and environment config
├── database/               # Database schema and migration files
├── includes/               # Shared public page components
├── legal/                  # Cookie Notice, Privacy Policy, Terms & Conditions
├── uploads/                # Uploaded product images
│
├── index.php               # Homepage
├── product_detail.php      # Product detail page
├── login.php               # Customer login page
├── signup.php              # Customer sign up page
├── user_page.php           # Customer account page
├── logout.php              # Customer logout
├── google_login.php        # Customer Google login
├── google_callback.php     # Customer Google callback
│
├── .env.example            # Example environment variable file
├── .gitignore              # Git ignored files
└── README.md               # Project documentation
```

## Environment Variables

This project uses a `.env` file for sensitive configuration. The `.env` file should not be uploaded to GitHub.

Create a `.env` file in the project root based on `.env.example`.

Example:

```env
DB_HOST=your_supabase_host
DB_PORT=5432
DB_NAME=postgres
DB_USER=your_database_user
DB_PASSWORD=your_database_password

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost/store_management/google_callback.php

ADMIN_GOOGLE_CLIENT_ID=your_admin_google_client_id
ADMIN_GOOGLE_CLIENT_SECRET=your_admin_google_client_secret
ADMIN_GOOGLE_REDIRECT_URI=http://localhost/store_management/admin/google_callback.php

GOOGLE_MAPS_API_KEY=your_google_maps_api_key
COMPANY_MAP_QUERY=MY DREAM BIKE SDN BHD
COMPANY_MAP_LINK=your_google_maps_link
```

## Local Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/store-management-system.git
```

### 2. Move Project to XAMPP

Move the project folder into:

```text
C:\xampp\htdocs\store_management
```

### 3. Create `.env` File

Copy `.env.example` and rename the copy to:

```text
.env
```

Then fill in your real database and API credentials.

### 4. Start XAMPP

Start:

```text
Apache
```

### 5. Open the Website

Customer side:

```text
http://localhost/store_management
```

Admin side:

```text
http://localhost/store_management/admin/login.php
```

## Database Setup

The project uses Supabase PostgreSQL.

Database schema and related SQL files are stored in:

```text
database/
```

Run the latest database schema or migration file in Supabase SQL Editor before testing the system.

Important database rule:

```text
product_id + color_id + size must be unique
```

This ensures that every product colour and size combination has only one stock quantity record.

## Google Login Setup

To use Google Login, create an OAuth Client ID in Google Cloud Console.

For local testing, add these Authorized Redirect URIs:

```text
http://localhost/store_management/google_callback.php
http://localhost/store_management/admin/google_callback.php
```

For online deployment, use your real deployed domain:

```text
https://your-domain.com/google_callback.php
https://your-domain.com/admin/google_callback.php
```

Then update the related values in your `.env` file or hosting environment variables.

## Google Maps Setup

To use Google Maps, create a Google Maps API key in Google Cloud Console.

Recommended API key restrictions:

```text
HTTP referrers
```

For local testing, allow:

```text
http://localhost/*
http://localhost/store_management/*
```

For online deployment, allow:

```text
https://your-domain.com/*
```

## Security Notes

The following files should not be uploaded to GitHub:

```text
.env
api/.env
database.db
*.log
```

The `.gitignore` file is included to prevent sensitive files from being committed.

Do not upload real database passwords, Google Client Secrets, or API keys to GitHub.

## Admin Access

The admin login page is accessible through:

```text
/admin/login.php
```

Example local URL:

```text
http://localhost/store_management/admin/login.php
```

The public website does not show an admin login button for security and professional appearance.

## Stock Report

The Stock Report page includes:

* Current Stock Levels
* Stock Movement History
* Product filter
* Colour filter
* Size filter
* Category and subcategory filter
* Movement type filter
* Date range filter
* Print function
* CSV export function

Stock movement records are treated as audit records and should not be edited or deleted directly.

## Future Improvements

Possible future enhancements:

* Add shopping cart and checkout
* Add order management
* Add customer purchase history
* Add email notifications
* Add product reviews
* Add role-based permissions
* Add Supabase Storage for product images
* Add PDF report export
* Add online payment integration

## Project Status

This project is currently developed as a web-based store management and inventory system for My Dream Bike. It is suitable for product management, stock tracking, and customer product browsing.
