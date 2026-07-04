<?php
if (!function_exists('stock_report_get_param')) {
    function stock_report_get_param(string $key, string $default = ''): string
    {
        return isset($_GET[$key]) ? trim((string)$_GET[$key]) : $default;
    }
}

if (!function_exists('stock_report_current_filters')) {
    function stock_report_current_filters(): array
    {
        return [
            'search' => stock_report_get_param('current_search'),
            'product_id' => max(0, (int)stock_report_get_param('current_product_id', '0')),
            'color_id' => max(0, (int)stock_report_get_param('current_color_id', '0')),
            'size' => stock_report_get_param('current_size'),
            'category' => stock_report_get_param('current_category'),
            'subcategory' => stock_report_get_param('current_subcategory'),
            'status' => stock_report_get_param('current_status'),
            'sort' => stock_report_get_param('current_sort', 'name_asc'),
        ];
    }
}

if (!function_exists('stock_report_history_filters')) {
    function stock_report_history_filters(): array
    {
        return [
            'search' => stock_report_get_param('history_search'),
            'product_id' => max(0, (int)stock_report_get_param('history_product_id', '0')),
            'color_id' => max(0, (int)stock_report_get_param('history_color_id', '0')),
            'size' => stock_report_get_param('history_size'),
            'type' => strtoupper(stock_report_get_param('history_type')),
            'category' => stock_report_get_param('history_category'),
            'subcategory' => stock_report_get_param('history_subcategory'),
            'date_from' => stock_report_get_param('date_from'),
            'date_to' => stock_report_get_param('date_to'),
        ];
    }
}

if (!function_exists('stock_report_current_where')) {
    function stock_report_current_where(array $filters): array
    {
        $where = ['1=1'];
        $params = [];

        if ($filters['search'] !== '') {
            $where[] = "(p.item_code ILIKE ? OR p.name ILIKE ? OR p.brand ILIKE ? OR p.category ILIKE ? OR p.sub_category ILIKE ? OR ps.size ILIKE ? OR pc.color_name ILIKE ?)";
            $like = '%' . $filters['search'] . '%';
            array_push($params, $like, $like, $like, $like, $like, $like, $like);
        }
        if ($filters['product_id'] > 0) {
            $where[] = 'p.id = ?';
            $params[] = $filters['product_id'];
        }
        if ($filters['color_id'] > 0) {
            $where[] = 'ps.color_id = ?';
            $params[] = $filters['color_id'];
        }
        if ($filters['size'] !== '') {
            $where[] = 'LOWER(TRIM(ps.size)) = LOWER(TRIM(?))';
            $params[] = $filters['size'];
        }
        if ($filters['category'] !== '') {
            $where[] = 'p.category = ?';
            $params[] = $filters['category'];
        }
        if ($filters['subcategory'] !== '') {
            $where[] = 'p.sub_category = ?';
            $params[] = $filters['subcategory'];
        }
        if ($filters['status'] === 'out') {
            $where[] = 'ps.quantity = 0';
        } elseif ($filters['status'] === 'low') {
            $where[] = 'ps.quantity > 0 AND ps.quantity < 5';
        } elseif ($filters['status'] === 'in') {
            $where[] = 'ps.quantity >= 5';
        }

        return [implode(' AND ', $where), $params];
    }
}

if (!function_exists('stock_report_current_order_by')) {
    function stock_report_current_order_by(string $sort): string
    {
        $sortOptions = [
            'name_asc' => 'p.name ASC, pc.color_name ASC, ps.size ASC',
            'item_code_asc' => 'p.item_code ASC, pc.color_name ASC, ps.size ASC',
            'category_asc' => 'p.category ASC, p.sub_category ASC, p.name ASC, pc.color_name ASC',
            'qty_asc' => 'ps.quantity ASC, p.name ASC, pc.color_name ASC',
            'qty_desc' => 'ps.quantity DESC, p.name ASC, pc.color_name ASC',
            'arrival_desc' => 'p.arrival_date DESC, p.name ASC, pc.color_name ASC'
        ];
        return $sortOptions[$sort] ?? $sortOptions['name_asc'];
    }
}

if (!function_exists('stock_report_current_rows')) {
    function stock_report_current_rows(PDO $conn): array
    {
        $filters = stock_report_current_filters();
        [$whereSql, $params] = stock_report_current_where($filters);
        $orderBy = stock_report_current_order_by($filters['sort']);

        $sql = "
            SELECT p.id, p.item_code, p.name, p.brand, p.category, p.sub_category, p.price, p.online_sell_price, p.arrival_date,
                   ps.id AS size_id, ps.color_id, COALESCE(pc.color_name, 'No colour assigned') AS color_name, ps.size, ps.quantity
            FROM products p
            JOIN product_sizes ps ON p.id = ps.product_id
            LEFT JOIN product_colors pc ON pc.id = ps.color_id
            WHERE {$whereSql}
            ORDER BY {$orderBy}
        ";
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}

if (!function_exists('stock_report_history_where')) {
    function stock_report_history_where(array $filters): array
    {
        $where = ['1=1'];
        $params = [];

        if ($filters['search'] !== '') {
            $where[] = "(p.item_code ILIKE ? OR p.name ILIKE ? OR p.category ILIKE ? OR p.sub_category ILIKE ? OR sh.size ILIKE ? OR pc.color_name ILIKE ? OR sh.reason ILIKE ? OR sh.note ILIKE ? OR sh.edited_by_admin_name ILIKE ?)";
            $like = '%' . $filters['search'] . '%';
            array_push($params, $like, $like, $like, $like, $like, $like, $like, $like, $like);
        }
        if ($filters['product_id'] > 0) {
            $where[] = 'p.id = ?';
            $params[] = $filters['product_id'];
        }
        if ($filters['color_id'] > 0) {
            $where[] = 'sh.color_id = ?';
            $params[] = $filters['color_id'];
        }
        if ($filters['size'] !== '') {
            $where[] = 'LOWER(TRIM(sh.size)) = LOWER(TRIM(?))';
            $params[] = $filters['size'];
        }
        if ($filters['type'] === 'IN' || $filters['type'] === 'OUT') {
            $where[] = 'sh.type = ?';
            $params[] = $filters['type'];
        }
        if ($filters['category'] !== '') {
            $where[] = 'p.category = ?';
            $params[] = $filters['category'];
        }
        if ($filters['subcategory'] !== '') {
            $where[] = 'p.sub_category = ?';
            $params[] = $filters['subcategory'];
        }
        if ($filters['date_from'] !== '') {
            $where[] = 'date(sh.created_at) >= date(?)';
            $params[] = $filters['date_from'];
        }
        if ($filters['date_to'] !== '') {
            $where[] = 'date(sh.created_at) <= date(?)';
            $params[] = $filters['date_to'];
        }

        return [implode(' AND ', $where), $params];
    }
}

if (!function_exists('stock_report_history_rows')) {
    function stock_report_history_rows(PDO $conn): array
    {
        $filters = stock_report_history_filters();
        [$whereSql, $params] = stock_report_history_where($filters);

        $sql = "
            SELECT sh.*, p.name AS product_name, p.item_code, p.category, p.sub_category, COALESCE(pc.color_name, 'No colour recorded') AS color_name
            FROM stock_history sh
            JOIN products p ON sh.product_id = p.id
            LEFT JOIN product_colors pc ON pc.id = sh.color_id
            WHERE {$whereSql}
            ORDER BY sh.created_at DESC
        ";
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}

if (!function_exists('stock_report_status_label')) {
    function stock_report_status_label(int $quantity): string
    {
        if ($quantity === 0) {
            return 'Out of Stock';
        }
        if ($quantity < 5) {
            return 'Low Stock';
        }
        return 'In Stock';
    }
}
