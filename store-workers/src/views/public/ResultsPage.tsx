import { CATEGORIES } from "../../lib/catalog";
import type { ProductCard, ProductFilters } from "../../lib/products";
import { ResultCard } from "./ProductCards";

/** Search / category results, the filtered view of index.php. */
export function ResultsPage({ products, filters }: { products: ProductCard[]; filters: ProductFilters }) {
  return (
    <div class="results-container">
      <div class="results-header">
        <h2>
          {filters.category ? (
            <>
              {filters.category}
              {filters.subCategory && <> › {filters.subCategory}</>}
            </>
          ) : filters.search ? (
            <>Results for “{filters.search}”</>
          ) : null}
        </h2>
        <a href="/" class="results-back">← Back to Home</a>
      </div>

      <form class="filter-bar" method="get" action="/">
        <input type="text" name="search" placeholder="Search products…" value={filters.search} />
        <select name="category" onchange="this.form.submit()">
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option value={cat.value} selected={filters.category === cat.value}>{cat.value}</option>
          ))}
        </select>
        <button type="submit">Search</button>
      </form>

      {products.length > 0 ? (
        <div class="product-grid">
          {products.map((product) => <ResultCard product={product} />)}
        </div>
      ) : (
        <div class="no-products"><p>No products found.</p></div>
      )}
    </div>
  );
}
