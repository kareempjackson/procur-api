# Home Module

This module provides aggregate data for the home page of the Procur application.

## Endpoints

### GET /home

Returns comprehensive home page data including:

- **Recommended Products**: Featured and recently added products
- **Popular Sellers**: Top-rated sellers with high sales volume
- **Best Selling Products**: Products with highest sales in the last 30 days
- **In Demand Products**: Products with the most active requests
- **Popular Requests**: Trending product requests from buyers

**Query Parameters:**

- `recommended_limit` (optional): Number of recommended products (1-20, default: 8)
- `sellers_limit` (optional): Number of popular sellers (1-15, default: 6)
- `best_selling_limit` (optional): Number of best selling products (1-20, default: 8)
- `in_demand_limit` (optional): Number of in-demand products (1-15, default: 6)
- `requests_limit` (optional): Number of popular requests (1-20, default: 10)
- `category` (optional): Filter results by specific category
- `user_location` (optional): User location for local recommendations (format: "lat,lng")

**Example Request:**

```
GET /home?recommended_limit=10&category=Vegetables&sellers_limit=8
```

### GET /home/stats

Returns basic platform statistics:

- Total active products
- Total verified sellers
- Total open requests

### GET /home/categories

Returns popular product categories with activity metrics:

- Category name
- Number of active products
- Number of open requests
- Combined activity score

## Features

- **Public Access**: All endpoints are publicly accessible (no authentication required)
- **Performance Optimized**: Uses parallel queries for fast response times
- **Flexible Filtering**: Support for category-based filtering
- **Location Awareness**: Future support for location-based recommendations
- **Real-time Data**: Fresh data with timestamps

## Data Sources

The module aggregates data from:

- `products` table - for product information and inventory
- `organizations` table - for seller information
- `product_requests` table - for buyer demand data
- `order_items` and `orders` tables - for sales analytics
- `transactions` table - for revenue calculations

## Future Enhancements

- User-specific recommendations based on browsing history
- Machine learning-based product suggestions
- Real-time trending calculations
- Advanced location-based filtering
- Review and rating system integration
