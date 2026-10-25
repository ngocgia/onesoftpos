/**
 * OnesoftPOS v1.0 - OpenAPI 3.0 / Swagger Specification
 * Hệ thống POS Quản lý bán hàng chuỗi ẩm thực (Multi-Store F&B)
 */

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'OnesoftPOS - Multi-Store F&B POS API',
    version: '1.0.0',
    description: `
## Giới thiệu hệ thống OnesoftPOS API

Tài liệu đặc tả toàn bộ REST API cho hệ thống quản lý bán hàng F&B đa chi nhánh **OnesoftPOS v1.0**.

### Các tính năng chính:
- **Xác thực & Phân quyền (Auth & RBAC)**: JWT Token, kiểm tra quyền theo vai trò (\`SUPER_ADMIN\`, \`ADMIN\`, \`STORE_MANAGER\`, \`CASHIER\`, \`KITCHEN\`, \`ORDER_STAFF\`) và ma trận tính năng (\`role_features\`, \`store_role_features\`).
- **Kiến trúc Đa chi nhánh (Multi-Store Context)**: Hỗ trợ nhiều cửa hàng độc lập hoặc chuỗi, chuyển đổi chi nhánh thông qua header \`X-Store-Id\`.
- **Mô hình linh hoạt (Store Types)**: Bán mang đi (\`TAKEAWAY\`) hoặc Tại chỗ kết hợp Mang đi (\`DINE_IN_TAKEAWAY\`).
- **Quản lý Thực đơn & Topping**: Danh mục, món ăn, biến thể size, nhóm topping và ràng buộc topping theo từng món.
- **Sơ đồ Bàn & Khu vực (Dine-in)**: Trạng thái bàn thời gian thực (\`EMPTY\`, \`OCCUPIED\`, \`RESERVED\`), chuyển bàn, ghép bàn tự động gộp đơn.
- **Quy trình đơn hàng (Workflow Engine)**: Tự động điều phối theo luồng cấu hình (Tạo đơn -> Bếp chế biến -> Thanh toán), hỗ trợ tách hóa đơn và đơn mang về/giao hàng.
- **Thanh toán & VietQR động**: Tiền mặt, chuyển khoản, thẻ, VietQR tự động sinh mã kèm số tiền và nội dung đơn.
- **Màn hình bếp KDS**: Điều phối món theo trạm chế biến (Bếp \`KITCHEN\`, Pha chế \`BAR\`), cập nhật trạng thái món, lịch sử và câu thông báo âm thanh tự động.
- **Quản lý Ca (Shifts) & Báo cáo (Reports)**: Mở/kết ca thu ngân, kiểm kê chênh lệch tiền mặt, báo cáo doanh thu theo mốc thời gian.
- **Quản trị hệ thống (Super Admin)**: Dashboard số liệu toàn chuỗi, quản lý người dùng, phân quyền chi nhánh và Audit Logs bảo mật.

### Hướng dẫn xác thực:
1. Gọi API \`POST /api/auth/login\` với tài khoản (ví dụ: \`admin\` / \`123456\`).
2. Copy chuỗi \`token\` trả về.
3. Bấm nút **Authorize** màu xanh ở góc phải trên Swagger UI, dán token vào ô \`bearerAuth\` dạng \`Bearer <token>\` hoặc chỉ chuỗi token.
4. Đối với các API yêu cầu ngữ cảnh cửa hàng, nhập ID cửa hàng vào header \`X-Store-Id\` (ví dụ: \`1\` hoặc \`2\`).
    `,
    contact: {
      name: 'OnesoftPOS Engineering Team',
      email: 'support@onesoftpos.vn'
    }
  },
  servers: [
    {
      url: '/api',
      description: 'Current Base API'
    },
    {
      url: 'http://localhost:3000/api',
      description: 'Local Development Server'
    }
  ],
  tags: [
    { name: 'Auth', description: 'Đăng nhập và thông tin phiên làm việc' },
    { name: 'Stores', description: 'Quản lý danh sách chi nhánh và cấu hình cửa hàng' },
    { name: 'Store Types', description: 'Mô hình kinh doanh và tính năng theo loại cửa hàng' },
    { name: 'Store Staff', description: 'Quản lý nhân sự và phân quyền riêng tại từng chi nhánh' },
    { name: 'Categories', description: 'Quản lý nhóm / danh mục thực đơn' },
    { name: 'Products', description: 'Quản lý danh sách món ăn, biến thể size và topping' },
    { name: 'Toppings', description: 'Quản lý nhóm topping và các món phụ thêm' },
    { name: 'Areas & Tables', description: 'Quản lý sơ đồ khu vực, bàn ăn, chuyển bàn và ghép bàn' },
    { name: 'Orders', description: 'Khởi tạo đơn, luồng vận hành, cập nhật trạng thái và tách đơn' },
    { name: 'Payments', description: 'Thanh toán đơn hàng và tạo mã VietQR động ngân hàng' },
    { name: 'KDS', description: 'Hệ thống hiển thị bếp (Kitchen Display System) và pha chế' },
    { name: 'Shifts', description: 'Quản lý ca làm việc, tiền mặt đầu ca và đối soát kết ca' },
    { name: 'Reports', description: 'Báo cáo doanh thu, số lượng đơn và top món bán chạy' },
    { name: 'Inventory', description: 'Quản lý kho, nguyên vật liệu, phiếu nhập xuất và báo cáo thống kê từ ngày đến ngày' },
    { name: 'Admin', description: 'Trung tâm quản trị Super Admin: người dùng, vai trò và nhật ký hệ thống' },
    { name: 'Health', description: 'Kiểm tra trạng thái hoạt động của máy chủ' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Nhập JWT token được cấp từ API /api/auth/login'
      },
      storeIdHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Store-Id',
        description: 'ID của cửa hàng thao tác (ví dụ: 1 hoặc 2)'
      }
    },
    parameters: {
      StoreIdHeader: {
        name: 'X-Store-Id',
        in: 'header',
        description: 'Mã ID cửa hàng hiện tại đang thao tác',
        required: false,
        schema: {
          type: 'integer',
          example: 1
        }
      }
    },
    schemas: {
      StandardResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Thao tác thành công' }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Thông báo lỗi chi tiết' }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'admin', description: 'Tên đăng nhập hoặc email' },
          password: { type: 'string', example: '123456', description: 'Mật khẩu tài khoản' }
        }
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              username: { type: 'string', example: 'admin' },
              email: { type: 'string', example: 'admin@onesoftpos.com' },
              full_name: { type: 'string', example: 'Quản trị viên Hệ Thống' },
              role: { type: 'string', example: 'SUPER_ADMIN', enum: ['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER', 'CASHIER', 'KITCHEN', 'ORDER_STAFF'] }
            }
          },
          stores: {
            type: 'array',
            items: { $ref: '#/components/schemas/Store' }
          },
          defaultStore: { $ref: '#/components/schemas/Store' },
          roleFeatures: {
            type: 'object',
            additionalProperties: { type: 'boolean' },
            example: { POS: true, TABLES: true, KDS: true, ORDERS: true, HISTORY: true, PAYMENT: true, ADMIN: true, SHIFT: true, DISCOUNT: true, COMPLETED_ITEMS: true }
          }
        }
      },
      Store: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          code: { type: 'string', example: 'STORE001' },
          name: { type: 'string', example: 'OnesoftPOS - Chi nhánh 1' },
          display_name: { type: 'string', example: 'OnesoftPOS - Quang Trung' },
          store_type_id: { type: 'integer', example: 2 },
          store_type_code: { type: 'string', example: 'DINE_IN_TAKEAWAY' },
          store_type_name: { type: 'string', example: 'Tại chỗ & Mang đi' },
          phone: { type: 'string', example: '0901234567' },
          email: { type: 'string', example: 'cn1@onesoftpos.vn' },
          address: { type: 'string', example: '123 Quang Trung, Phường 10, Gò Vấp' },
          province: { type: 'string', example: 'Hồ Chí Minh' },
          district: { type: 'string', example: 'Gò Vấp' },
          tax_code: { type: 'string', example: '0312345678' },
          logo_url: { type: 'string', example: '🍗' },
          opening_time: { type: 'string', example: '08:00' },
          closing_time: { type: 'string', example: '22:30' },
          currency: { type: 'string', example: 'VND' },
          status: { type: 'string', example: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] }
        }
      },
      StoreSettings: {
        type: 'object',
        properties: {
          store_id: { type: 'integer', example: 1 },
          receipt_header: { type: 'string', example: 'HỆ THỐNG GÀ RÁN & TRÀ SỮA ONESOFTPOS' },
          receipt_footer: { type: 'string', example: 'Cảm ơn Quý khách & Hẹn gặp lại!' },
          receipt_paper_size: { type: 'string', example: '80mm', enum: ['58mm', '80mm'] },
          bank_name: { type: 'string', example: 'MB Bank' },
          bank_account_number: { type: 'string', example: '090123456789' },
          bank_account_holder: { type: 'string', example: 'ONESOFTPOS CN1' },
          kds_enabled: { type: 'boolean', example: true },
          allow_cancel_item: { type: 'boolean', example: true, description: 'Cho phép vai trò KITCHEN hủy món' },
          kds_completion_message: { type: 'string', example: 'Món ăn {mon}, bàn {ban} đã xong' },
          takeaway_workspace_enabled: { type: 'boolean', example: false },
          product_modifier_popup_enabled: { type: 'boolean', default: true, description: 'Bật popup tùy chọn/ghi chú khi bấm dấu cộng. Tắt để thêm món với kích cỡ mặc định, không topping.' },
          workflow_definition: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Thu ngân - Bếp - Thanh toán' },
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', example: 'create' },
                    name: { type: 'string', example: 'Thu ngân tạo đơn' },
                    type: { type: 'string', example: 'CREATE', enum: ['CREATE', 'APPROVAL', 'KITCHEN', 'PAYMENT'] },
                    roles: { type: 'array', items: { type: 'string' }, example: ['CASHIER'] }
                  }
                }
              }
            }
          }
        }
      },
      StoreType: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          code: { type: 'string', example: 'TAKEAWAY' },
          name: { type: 'string', example: 'Chỉ bán mang đi' },
          description: { type: 'string', example: 'Mô hình Kiot chuyên mang đi' },
          is_active: { type: 'boolean', example: true },
          features: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                feature_code: { type: 'string', example: 'SALE' },
                enabled: { type: 'boolean', example: true }
              }
            }
          }
        }
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          store_id: { type: 'integer', example: 1 },
          code: { type: 'string', example: 'CAT_GA' },
          name: { type: 'string', example: 'Gà Rán Giòn Cay' },
          description: { type: 'string', example: 'Các món gà rán thơm giòn' },
          sort_order: { type: 'integer', example: 1 },
          is_active: { type: 'boolean', example: true }
        }
      },
      ProductVariant: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          product_id: { type: 'integer', example: 1 },
          size_name: { type: 'string', example: 'Lớn (L)' },
          price_adjustment: { type: 'number', example: 15000 },
          is_default: { type: 'boolean', example: false }
        }
      },
      ProductOption: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          store_id: { type: 'integer', example: 1 },
          group_id: { type: 'integer', example: 1, nullable: true },
          name: { type: 'string', example: 'Phô mai lắc' },
          price: { type: 'number', example: 10000 },
          is_active: { type: 'boolean', example: true },
          product_ids: {
            type: 'array',
            items: { type: 'integer' },
            example: [1, 2, 3]
          }
        }
      },
      ToppingGroup: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          store_id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Topping sốt chấm' },
          description: { type: 'string', example: 'Các loại sốt phủ đặc biệt' },
          sort_order: { type: 'integer', example: 1 },
          is_active: { type: 'boolean', example: true },
          topping_count: { type: 'integer', example: 4 }
        }
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          store_id: { type: 'integer', example: 1 },
          category_id: { type: 'integer', example: 1 },
          category_name: { type: 'string', example: 'Gà Rán' },
          code: { type: 'string', example: 'GA01' },
          name: { type: 'string', example: 'Gà Rán Giòn Cay' },
          description: { type: 'string', example: 'Đùi và cánh gà tẩm ớt bột cay giòn rụm' },
          price: { type: 'number', example: 35000 },
          cost_price: { type: 'number', example: 20000 },
          unit: { type: 'string', example: 'Phần' },
          image_url: { type: 'string', example: '🍗' },
          kitchen_type: { type: 'string', example: 'KITCHEN', enum: ['KITCHEN', 'BAR'] },
          is_active: { type: 'boolean', example: true },
          variants: {
            type: 'array',
            items: { $ref: '#/components/schemas/ProductVariant' }
          },
          options: {
            type: 'array',
            items: { $ref: '#/components/schemas/ProductOption' }
          }
        }
      },
      Area: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          store_id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Tầng 1 - Sảnh chính' },
          sort_order: { type: 'integer', example: 1 },
          is_active: { type: 'boolean', example: true }
        }
      },
      Table: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          store_id: { type: 'integer', example: 1 },
          area_id: { type: 'integer', example: 1 },
          area_name: { type: 'string', example: 'Tầng 1 - Sảnh chính' },
          code: { type: 'string', example: 'B01' },
          name: { type: 'string', example: 'Bàn 01' },
          seats: { type: 'integer', example: 4 },
          status: { type: 'string', example: 'EMPTY', enum: ['EMPTY', 'OCCUPIED', 'RESERVED'] },
          current_order_id: { type: 'integer', example: null, nullable: true },
          order_code: { type: 'string', example: null, nullable: true },
          total_amount: { type: 'number', example: 0 },
          order_time: { type: 'string', example: null, nullable: true },
          sort_order: { type: 'integer', example: 1 }
        }
      },
      OrderItemOption: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          order_item_id: { type: 'integer', example: 10 },
          option_id: { type: 'integer', example: 2 },
          option_name: { type: 'string', example: 'Trân châu đường đen' },
          price: { type: 'number', example: 5000 }
        }
      },
      OrderItem: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          order_id: { type: 'integer', example: 100 },
          product_id: { type: 'integer', example: 1 },
          variant_id: { type: 'integer', example: 1, nullable: true },
          product_name: { type: 'string', example: 'Gà Rán Giòn Cay' },
          variant_name: { type: 'string', example: 'Size Lớn', nullable: true },
          unit_price: { type: 'number', example: 35000 },
          quantity: { type: 'integer', example: 2 },
          subtotal: { type: 'number', example: 80000 },
          note: { type: 'string', example: 'Ít cay' },
          status: { type: 'string', example: 'PENDING', enum: ['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'] },
          kitchen_type: { type: 'string', example: 'KITCHEN', enum: ['KITCHEN', 'BAR'] },
          prepared_by: { type: 'integer', example: null, nullable: true },
          prepared_at: { type: 'string', example: null, nullable: true },
          options: {
            type: 'array',
            items: { $ref: '#/components/schemas/OrderItemOption' }
          }
        }
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 101 },
          order_code: { type: 'string', example: 'TG260919-4821' },
          store_id: { type: 'integer', example: 1 },
          shift_id: { type: 'integer', example: 5, nullable: true },
          order_type: { type: 'string', example: 'TAKEAWAY', enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'] },
          order_source: { type: 'string', example: 'POS', enum: ['POS', 'QR_TABLE', 'WEB'] },
          fulfillment_type: { type: 'string', example: 'CUSTOMER_PICKUP', enum: ['SHIP_DELIVERY', 'CUSTOMER_PICKUP', 'APP_DELIVERY'], nullable: true },
          table_id: { type: 'integer', example: null, nullable: true },
          table_name: { type: 'string', example: null, nullable: true },
          table_code: { type: 'string', example: null, nullable: true },
          customer_name: { type: 'string', example: 'Nguyễn Văn A', nullable: true },
          customer_phone: { type: 'string', example: '0987654321', nullable: true },
          delivery_address: { type: 'string', example: null, nullable: true },
          scheduled_at: { type: 'string', example: null, nullable: true },
          cashier_id: { type: 'integer', example: 3 },
          cashier_name: { type: 'string', example: 'Trần Thu Ngân' },
          subtotal: { type: 'number', example: 70000 },
          discount_amount: { type: 'number', example: 0 },
          tax_amount: { type: 'number', example: 0 },
          total_amount: { type: 'number', example: 70000 },
          payment_status: { type: 'string', example: 'UNPAID', enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'] },
          order_status: { type: 'string', example: 'CONFIRMED', enum: ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] },
          workflow_stage_index: { type: 'integer', example: 1 },
          note: { type: 'string', example: 'Giao nhanh trước 12h' },
          created_at: { type: 'string', example: '2026-09-19T10:15:30Z' }
        }
      },
      CreateOrderRequest: {
        type: 'object',
        required: ['items'],
        properties: {
          store_id: { type: 'integer', example: 1, description: 'Có thể bỏ qua nếu đã truyền header X-Store-Id' },
          order_type: { type: 'string', example: 'TAKEAWAY', enum: ['DINE_IN', 'TAKEAWAY', 'DELIVERY'] },
          table_id: { type: 'integer', example: null, description: 'Bắt buộc nếu order_type = DINE_IN' },
          fulfillment_type: { type: 'string', example: 'CUSTOMER_PICKUP', enum: ['SHIP_DELIVERY', 'CUSTOMER_PICKUP', 'APP_DELIVERY'] },
          customer_name: { type: 'string', example: 'Anh Hoàng' },
          customer_phone: { type: 'string', example: '0912345678' },
          delivery_address: { type: 'string', example: '456 Lê Văn Sỹ, P.14, Q.3' },
          scheduled_at: { type: 'string', example: '2026-09-19T12:00:00Z' },
          discount_amount: { type: 'number', example: 0 },
          tax_amount: { type: 'number', example: 0 },
          note: { type: 'string', example: 'Không lấy đá' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['product_id', 'product_name', 'unit_price', 'quantity'],
              properties: {
                product_id: { type: 'integer', example: 1 },
                variant_id: { type: 'integer', example: null },
                product_name: { type: 'string', example: 'Gà Rán Giòn Cay' },
                variant_name: { type: 'string', example: null },
                unit_price: { type: 'number', example: 35000 },
                quantity: { type: 'integer', example: 2 },
                note: { type: 'string', example: 'Cay vừa' },
                kitchen_type: { type: 'string', example: 'KITCHEN' },
                options: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['option_id'],
                    properties: {
                      option_id: { type: 'integer', example: 1 },
                      option_name: { type: 'string', example: 'Sốt Phô Mai' },
                      price: { type: 'number', example: 5000 }
                    }
                  }
                }
              }
            }
          }
        }
      },
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          order_id: { type: 'integer', example: 101 },
          store_id: { type: 'integer', example: 1 },
          payment_method: { type: 'string', example: 'CASH', enum: ['CASH', 'BANK_TRANSFER', 'QR', 'CARD'] },
          amount: { type: 'number', example: 70000 },
          cash_received: { type: 'number', example: 100000 },
          cash_return: { type: 'number', example: 30000 },
          transaction_code: { type: 'string', example: 'TXN123456789', nullable: true },
          status: { type: 'string', example: 'SUCCESS', enum: ['SUCCESS', 'FAILED', 'CANCELLED', 'REPLACED'] },
          created_at: { type: 'string', example: '2026-09-19T10:20:00Z' }
        }
      },
      ProcessPaymentRequest: {
        type: 'object',
        required: ['order_id', 'amount'],
        properties: {
          order_id: { type: 'integer', example: 101 },
          payment_method: { type: 'string', example: 'CASH', enum: ['CASH', 'BANK_TRANSFER', 'QR', 'CARD'] },
          amount: { type: 'number', example: 70000 },
          cash_received: { type: 'number', example: 100000, description: 'Số tiền khách đưa (dành cho tiền mặt)' },
          transaction_code: { type: 'string', example: 'MB-102938475' },
          replace_existing: { type: 'boolean', example: false, description: 'True nếu thanh toán lại cho đơn đã thanh toán trước đó' }
        }
      },
      VietQRResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          qrUrl: { type: 'string', example: 'https://img.vietqr.io/image/970422-090123456789-compact2.png?amount=70000&addInfo=TG260919-4821&accountName=THICH%20GA%20POS' },
          bankName: { type: 'string', example: 'MB Bank' },
          bankAccount: { type: 'string', example: '090123456789' },
          accountHolder: { type: 'string', example: 'ONESOFTPOS CN1' },
          amount: { type: 'number', example: 70000 },
          memo: { type: 'string', example: 'TG260919-4821' }
        }
      },
      Shift: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          store_id: { type: 'integer', example: 1 },
          user_id: { type: 'integer', example: 3 },
          opening_time: { type: 'string', example: '2026-09-19T08:00:00Z' },
          closing_time: { type: 'string', example: null, nullable: true },
          opening_cash: { type: 'number', example: 1000000 },
          closing_cash: { type: 'number', example: 0 },
          expected_cash: { type: 'number', example: 1000000 },
          difference: { type: 'number', example: 0 },
          status: { type: 'string', example: 'OPEN', enum: ['OPEN', 'CLOSED'] },
          notes: { type: 'string', example: 'Tiền mặt đầu ca gồm 10 tờ 100k' }
        }
      }
    }
  },
  security: [
    { bearerAuth: [] }
  ],
  paths: {
    // ------------------------------------------------------------------------
    // HEALTH
    // ------------------------------------------------------------------------
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Kiểm tra trạng thái hoạt động của hệ thống',
        description: 'Endpoint công khai không yêu cầu token, trả về trạng thái máy chủ, thời gian hiện tại và phiên bản hệ thống.',
        security: [],
        responses: {
          200: {
            description: 'Máy chủ hoạt động bình thường',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    time: { type: 'string', example: '2026-09-19T15:45:00.000Z' },
                    system: { type: 'string', example: 'OnesoftPOS v1.0' }
                  }
                }
              }
            }
          }
        }
      }
    },

    // ------------------------------------------------------------------------
    // AUTH
    // ------------------------------------------------------------------------
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng nhập vào hệ thống',
        description: 'Xác thực tài khoản qua username/email và mật khẩu. Trả về token JWT có thời hạn 7 ngày kèm danh sách cửa hàng được quyền truy cập.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'Đăng nhập thành công',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' }
              }
            }
          },
          400: {
            description: 'Thiếu username hoặc password',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          401: {
            description: 'Sai thông tin đăng nhập',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Lấy thông tin tài khoản hiện tại',
        description: 'Dựa vào token JWT trong Authorization header để trả về thông tin user, danh sách chi nhánh và quyền chức năng.',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        responses: {
          200: {
            description: 'Thông tin tài khoản hợp lệ',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    user: { $ref: '#/components/schemas/LoginResponse/properties/user' },
                    stores: { type: 'array', items: { $ref: '#/components/schemas/Store' } },
                    roleFeatures: { type: 'object', additionalProperties: { type: 'boolean' } }
                  }
                }
              }
            }
          },
          401: {
            description: 'Chưa đăng nhập hoặc token không hợp lệ',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    // ------------------------------------------------------------------------
    // STORES
    // ------------------------------------------------------------------------
    '/stores': {
      get: {
        tags: ['Stores'],
        summary: 'Lấy danh sách cửa hàng được truy cập',
        description: 'Admin/Super Admin thấy tất cả cửa hàng. Các vai trò khác chỉ thấy cửa hàng được phân công trong user_stores.',
        responses: {
          200: {
            description: 'Danh sách cửa hàng',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    stores: { type: 'array', items: { $ref: '#/components/schemas/Store' } }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Stores'],
        summary: 'Tạo cửa hàng mới',
        description: 'Yêu cầu vai trò SUPER_ADMIN hoặc ADMIN. Tự động khởi tạo cài đặt store_settings mặc định.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'name', 'store_type_id'],
                properties: {
                  code: { type: 'string', example: 'STORE003' },
                  name: { type: 'string', example: 'OnesoftPOS - Chi nhánh Bình Thạnh' },
                  display_name: { type: 'string', example: 'OnesoftPOS - Xô Viết Nghệ Tĩnh' },
                  store_type_id: { type: 'integer', example: 2 },
                  phone: { type: 'string', example: '0908887776' },
                  email: { type: 'string', example: 'binhthanh@onesoftpos.vn' },
                  address: { type: 'string', example: '456 Xô Viết Nghệ Tĩnh, P.25' },
                  province: { type: 'string', example: 'Hồ Chí Minh' },
                  district: { type: 'string', example: 'Bình Thạnh' }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: 'Tạo cửa hàng thành công',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Tạo cửa hàng thành công' },
                    store: { $ref: '#/components/schemas/Store' }
                  }
                }
              }
            }
          },
          400: { description: 'Dữ liệu không hợp lệ' },
          403: { description: 'Không đủ quyền' }
        }
      }
    },
    '/stores/{id}': {
      get: {
        tags: ['Stores'],
        summary: 'Lấy thông tin chi tiết một cửa hàng',
        description: 'Bao gồm thông tin cửa hàng, cài đặt hóa đơn, ngân hàng VietQR và cờ tính năng mô hình.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 }, description: 'Mã ID cửa hàng' }
        ],
        responses: {
          200: {
            description: 'Chi tiết cửa hàng',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    store: { $ref: '#/components/schemas/Store' },
                    settings: { $ref: '#/components/schemas/StoreSettings' },
                    storeType: { $ref: '#/components/schemas/StoreType' },
                    features: { type: 'object' }
                  }
                }
              }
            }
          },
          404: { description: 'Không tìm thấy cửa hàng' }
        }
      },
      put: {
        tags: ['Stores'],
        summary: 'Cập nhật thông tin cửa hàng',
        description: 'Yêu cầu vai trò SUPER_ADMIN, ADMIN hoặc STORE_MANAGER quản lý cửa hàng đó.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'OnesoftPOS - Quang Trung Mới' },
                  display_name: { type: 'string', example: 'OnesoftPOS - Chi nhánh 1' },
                  store_type_id: { type: 'integer', example: 2 },
                  phone: { type: 'string', example: '0901234567' },
                  email: { type: 'string', example: 'cn1@onesoftpos.vn' },
                  address: { type: 'string', example: '123 Quang Trung, Gò Vấp' },
                  status: { type: 'string', example: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Cập nhật thành công', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardResponse' } } } }
        }
      },
      delete: {
        tags: ['Stores'],
        summary: 'Xóa vĩnh viễn một cửa hàng',
        description: 'Yêu cầu vai trò SUPER_ADMIN hoặc ADMIN. Xóa toàn bộ dữ liệu ràng buộc: bàn, thực đơn, đơn hàng, hóa đơn, ca làm việc.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } }
        ],
        responses: {
          200: { description: 'Đã xóa cửa hàng', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardResponse' } } } }
        }
      }
    },
    '/stores/{id}/settings': {
      put: {
        tags: ['Stores'],
        summary: 'Cập nhật cấu hình cửa hàng (In ấn, VietQR, KDS, Workflow)',
        description: 'Cấu hình tiêu đề/chân hóa đơn, kích thước giấy in (58mm/80mm), tài khoản ngân hàng chuyển khoản, câu thông báo âm thanh KDS và luồng quy trình duyệt đơn.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/StoreSettings' }
            }
          }
        },
        responses: {
          200: { description: 'Đã lưu cấu hình cửa hàng', content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardResponse' } } } },
          400: { description: 'Dữ liệu cấu hình không hợp lệ' }
        }
      }
    },

    // ------------------------------------------------------------------------
    // STORE TYPES
    // ------------------------------------------------------------------------
    '/store-types': {
      get: {
        tags: ['Store Types'],
        summary: 'Lấy danh sách các loại mô hình cửa hàng',
        responses: {
          200: {
            description: 'Danh sách loại cửa hàng',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    storeTypes: { type: 'array', items: { $ref: '#/components/schemas/StoreType' } }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Store Types'],
        summary: 'Tạo loại mô hình cửa hàng mới',
        description: 'Chỉ SUPER_ADMIN hoặc ADMIN được phép tạo.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'name'],
                properties: {
                  code: { type: 'string', example: 'DELIVERY_ONLY' },
                  name: { type: 'string', example: 'Chuyên giao hàng (Cloud Kitchen)' },
                  description: { type: 'string', example: 'Mô hình bếp trung tâm chuyên ship' },
                  features: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        feature_code: { type: 'string', example: 'SALE' },
                        enabled: { type: 'boolean', example: true }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Tạo thành công' },
          409: { description: 'Mã loại cửa hàng đã tồn tại' }
        }
      }
    },
    '/store-types/{id}': {
      put: {
        tags: ['Store Types'],
        summary: 'Cập nhật thông tin loại cửa hàng',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Mô hình ăn tại chỗ nâng cao' },
                  description: { type: 'string', example: 'Có phòng VIP và đặt tiệc' },
                  is_active: { type: 'boolean', example: true }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Cập nhật thành công' } }
      },
      delete: {
        tags: ['Store Types'],
        summary: 'Xóa loại cửa hàng',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Đã xóa loại cửa hàng' } }
      }
    },
    '/store-types/{id}/features': {
      put: {
        tags: ['Store Types'],
        summary: 'Bật/tắt tính năng theo loại cửa hàng',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['feature_code', 'enabled'],
                properties: {
                  feature_code: { type: 'string', example: 'TABLE', enum: ['SALE', 'TAKEAWAY', 'DINE_IN', 'TABLE', 'KDS', 'INVOICE', 'QR_PAYMENT', 'INVENTORY'] },
                  enabled: { type: 'boolean', example: true }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Đã cập nhật tính năng' } }
      }
    },

    // ------------------------------------------------------------------------
    // STORE STAFF & STORE ROLE FEATURES
    // ------------------------------------------------------------------------
    '/store/staff': {
      get: {
        tags: ['Store Staff'],
        summary: 'Danh sách nhân viên thuộc chi nhánh hiện tại',
        description: 'Dành cho STORE_MANAGER quản lý nhân viên chi nhánh mình (vai trò ORDER_STAFF, CASHIER, KITCHEN).',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        responses: {
          200: {
            description: 'Danh sách nhân viên',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    staff: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer', example: 10 },
                          username: { type: 'string', example: 'cashier_cn1' },
                          email: { type: 'string', example: 'nv1@onesoftpos.vn' },
                          full_name: { type: 'string', example: 'Lê Thu Ngân' },
                          phone: { type: 'string', example: '0912333444' },
                          role: { type: 'string', example: 'CASHIER' },
                          status: { type: 'string', example: 'ACTIVE' },
                          completed_items_enabled: { type: 'boolean', example: true }
                        }
                      }
                    },
                    roles: { type: 'array', items: { type: 'string' }, example: ['ORDER_STAFF', 'CASHIER', 'KITCHEN'] }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Store Staff'],
        summary: 'Tạo tài khoản nhân viên chi nhánh',
        description: 'Tạo tài khoản và tự động gán vào chi nhánh hiện tại.',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password', 'email', 'full_name'],
                properties: {
                  username: { type: 'string', example: 'kitchen_cn1' },
                  password: { type: 'string', example: '123456' },
                  email: { type: 'string', example: 'kitchen_cn1@onesoftpos.vn' },
                  full_name: { type: 'string', example: 'Nguyễn Bếp Trưởng' },
                  phone: { type: 'string', example: '0933222111' },
                  role: { type: 'string', example: 'KITCHEN', enum: ['ORDER_STAFF', 'CASHIER', 'KITCHEN'] },
                  status: { type: 'string', example: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE'] },
                  completed_items_enabled: { type: 'boolean', example: true }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Tạo tài khoản nhân viên thành công' } }
      }
    },
    '/store/staff/{id}': {
      put: {
        tags: ['Store Staff'],
        summary: 'Cập nhật thông tin nhân viên chi nhánh',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  full_name: { type: 'string', example: 'Lê Thu Ngân Cũ' },
                  email: { type: 'string', example: 'nv1_new@onesoftpos.vn' },
                  phone: { type: 'string', example: '0988776655' },
                  role: { type: 'string', example: 'CASHIER', enum: ['ORDER_STAFF', 'CASHIER', 'KITCHEN'] },
                  status: { type: 'string', example: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE'] },
                  completed_items_enabled: { type: 'boolean', example: false }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Cập nhật thành công' } }
      }
    },
    '/store/staff/{id}/reset-password': {
      put: {
        tags: ['Store Staff'],
        summary: 'Đặt lại mật khẩu cho nhân viên chi nhánh',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password'],
                properties: {
                  password: { type: 'string', example: 'newPassword123', minLength: 6 }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Đã đặt lại mật khẩu nhân viên' } }
      }
    },
    '/store/role-features': {
      get: {
        tags: ['Store Staff'],
        summary: 'Lấy ma trận phân quyền theo vai trò tại chi nhánh',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        responses: { 200: { description: 'Ma trận quyền chi nhánh' } }
      }
    },
    '/store/role-features/{role}': {
      put: {
        tags: ['Store Staff'],
        summary: 'Bật/tắt tính năng cho vai trò cụ thể tại chi nhánh',
        parameters: [
          { name: 'role', in: 'path', required: true, schema: { type: 'string', enum: ['ORDER_STAFF', 'CASHIER', 'KITCHEN'] } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['feature_code', 'enabled'],
                properties: {
                  feature_code: { type: 'string', example: 'DISCOUNT', enum: ['POS', 'TABLES', 'KDS', 'ORDERS', 'HISTORY', 'PAYMENT', 'ADMIN', 'SHIFT', 'DISCOUNT', 'COMPLETED_ITEMS'] },
                  enabled: { type: 'boolean', example: true }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Đã cập nhật quyền chi nhánh' } }
      }
    },

    // ------------------------------------------------------------------------
    // CATEGORIES
    // ------------------------------------------------------------------------
    '/categories': {
      get: {
        tags: ['Categories'],
        summary: 'Lấy danh sách danh mục món của cửa hàng',
        parameters: [
          { $ref: '#/components/parameters/StoreIdHeader' },
          { name: 'store_id', in: 'query', schema: { type: 'integer' }, description: 'Lọc theo ID cửa hàng' }
        ],
        responses: {
          200: {
            description: 'Danh sách danh mục',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    categories: { type: 'array', items: { $ref: '#/components/schemas/Category' } }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Categories'],
        summary: 'Tạo mới danh mục món',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  code: { type: 'string', example: 'CAT_DO_UONG' },
                  name: { type: 'string', example: 'Trà Sữa & Đồ Uống' },
                  description: { type: 'string', example: 'Trà trái cây, trà sữa béo ngậy' },
                  sort_order: { type: 'integer', example: 2 }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Tạo danh mục thành công' } }
      }
    },
    '/categories/{id}': {
      put: {
        tags: ['Categories'],
        summary: 'Cập nhật danh mục món',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'CAT_DO_UONG' },
                  name: { type: 'string', example: 'Trà Sữa & Thức Uống Hot' },
                  description: { type: 'string', example: 'Cập nhật mô tả' },
                  sort_order: { type: 'integer', example: 1 },
                  is_active: { type: 'boolean', example: true }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Cập nhật danh mục thành công' } }
      },
      delete: {
        tags: ['Categories'],
        summary: 'Xóa danh mục món',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: { 200: { description: 'Đã xóa danh mục' } }
      }
    },

    // ------------------------------------------------------------------------
    // PRODUCTS & TOPPING LINKS
    // ------------------------------------------------------------------------
    '/product-images': {
      post: {
        tags: ['Products'],
        summary: 'Tải ảnh món ăn lên cho cửa hàng đang chọn',
        description: 'Dành cho ADMIN, SUPER_ADMIN hoặc STORE_MANAGER của cửa hàng. JPG/PNG/WebP tối đa 1 MB sau tối ưu. Gán image_url trả về khi tạo hoặc sửa sản phẩm.',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['image'], properties: { image: { type: 'string', description: 'Data URL base64 của ảnh JPG, PNG hoặc WebP' } }
        } } } },
        responses: {
          201: { description: 'Đã lưu ảnh, trả về image_url' },
          400: { description: 'Ảnh không hợp lệ hoặc chưa chọn cửa hàng' },
          403: { description: 'Không có quyền quản lý cửa hàng' },
          413: { description: 'Dữ liệu tải lên quá lớn' }
        }
      }
    },
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'Lấy danh sách món ăn của cửa hàng',
        description: 'Bao gồm chi tiết món, biến thể kích cỡ (variants) và các topping được phép áp dụng.',
        parameters: [
          { $ref: '#/components/parameters/StoreIdHeader' },
          { name: 'store_id', in: 'query', schema: { type: 'integer' } },
          { name: 'category_id', in: 'query', schema: { type: 'integer' }, description: 'Lọc theo danh mục' },
          { name: 'include_inactive', in: 'query', schema: { type: 'boolean', example: false }, description: 'Bao gồm món đang ẩn (dành cho quản lý)' }
        ],
        responses: {
          200: {
            description: 'Danh sách sản phẩm',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    products: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                    options: { type: 'array', items: { $ref: '#/components/schemas/ProductOption' } }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Products'],
        summary: 'Tạo món ăn mới',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'name', 'price'],
                properties: {
                  category_id: { type: 'integer', example: 1 },
                  code: { type: 'string', example: 'GA_XOI_MO' },
                  name: { type: 'string', example: 'Cơm Gà Xối Mỡ Mắm Tỏi' },
                  description: { type: 'string', example: 'Đùi gà xối mỡ da giòn rụm kèm cơm chiên hoàng bào' },
                  price: { type: 'number', example: 45000 },
                  cost_price: { type: 'number', example: 25000 },
                  unit: { type: 'string', example: 'Dĩa' },
                  image_url: { type: 'string', example: '🍗' },
                  kitchen_type: { type: 'string', example: 'KITCHEN', enum: ['KITCHEN', 'BAR'] },
                  variants: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        size_name: { type: 'string', example: 'Thêm đùi' },
                        price_adjustment: { type: 'number', example: 25000 },
                        is_default: { type: 'boolean', example: false }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Tạo món thành công' } }
      }
    },
    '/products/{id}': {
      put: {
        tags: ['Products'],
        summary: 'Cập nhật thông tin món ăn',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Cơm Gà Xối Mỡ Đặc Biệt' },
                  price: { type: 'number', example: 50000 },
                  cost_price: { type: 'number', example: 27000 },
                  is_active: { type: 'boolean', example: true }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Cập nhật thành công' } }
      },
      delete: {
        tags: ['Products'],
        summary: 'Xóa hoặc ẩn món ăn',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: { 200: { description: 'Đã xóa hoặc ẩn món ăn' } }
      }
    },
    '/products/{id}/toppings': {
      put: {
        tags: ['Products'],
        summary: 'Cập nhật danh sách topping áp dụng cho món ăn',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['topping_ids'],
                properties: {
                  topping_ids: { type: 'array', items: { type: 'integer' }, example: [1, 2, 5] }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Đã cập nhật topping cho món' } }
      }
    },
    '/products/options': {
      get: {
        tags: ['Products'],
        summary: 'Lấy toàn bộ topping/options khả dụng của cửa hàng',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        responses: { 200: { description: 'Danh sách options' } }
      }
    },

    // ------------------------------------------------------------------------
    // TOPPINGS & TOPPING GROUPS
    // ------------------------------------------------------------------------
    '/toppings': {
      get: {
        tags: ['Toppings'],
        summary: 'Lấy danh sách topping đầy đủ',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        responses: { 200: { description: 'Danh sách topping kèm món áp dụng' } }
      },
      post: {
        tags: ['Toppings'],
        summary: 'Thêm mới topping',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'price'],
                properties: {
                  group_id: { type: 'integer', example: 1 },
                  name: { type: 'string', example: 'Phô mai tươi kéo sợi' },
                  price: { type: 'number', example: 12000 },
                  product_ids: { type: 'array', items: { type: 'integer' }, example: [1, 2] }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Đã thêm topping' } }
      }
    },
    '/toppings/{id}': {
      put: {
        tags: ['Toppings'],
        summary: 'Cập nhật topping',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Phô mai Mozzarella' },
                  price: { type: 'number', example: 15000 },
                  is_active: { type: 'boolean', example: true },
                  product_ids: { type: 'array', items: { type: 'integer' }, example: [1, 3] }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Đã cập nhật topping' } }
      },
      delete: {
        tags: ['Toppings'],
        summary: 'Xóa topping',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: { 200: { description: 'Đã xóa topping' } }
      }
    },
    '/topping-groups': {
      get: {
        tags: ['Toppings'],
        summary: 'Lấy danh sách nhóm topping',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        responses: { 200: { description: 'Danh sách nhóm topping' } }
      },
      post: {
        tags: ['Toppings'],
        summary: 'Tạo nhóm topping',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Topping trà sữa' },
                  description: { type: 'string', example: 'Các loại thạch, trân châu, pudding' },
                  sort_order: { type: 'integer', example: 1 }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Đã thêm nhóm topping' } }
      }
    },
    '/topping-groups/{id}': {
      put: {
        tags: ['Toppings'],
        summary: 'Cập nhật nhóm topping',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: { 200: { description: 'Đã cập nhật nhóm topping' } }
      },
      delete: {
        tags: ['Toppings'],
        summary: 'Xóa nhóm topping',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: { 200: { description: 'Đã xóa nhóm topping' } }
      }
    },

    // ------------------------------------------------------------------------
    // AREAS & TABLES
    // ------------------------------------------------------------------------
    '/areas': {
      get: {
        tags: ['Areas & Tables'],
        summary: 'Lấy danh sách khu vực / phòng bàn',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        responses: { 200: { description: 'Danh sách khu vực' } }
      },
      post: {
        tags: ['Areas & Tables'],
        summary: 'Thêm khu vực / phòng mới',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Tầng 2 - Máy lạnh' },
                  sort_order: { type: 'integer', example: 2 }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Đã thêm khu vực/phòng' } }
      }
    },
    '/areas/{id}': {
      put: {
        tags: ['Areas & Tables'],
        summary: 'Cập nhật khu vực / phòng',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: { 200: { description: 'Đã cập nhật khu vực' } }
      },
      delete: {
        tags: ['Areas & Tables'],
        summary: 'Xóa khu vực (khi không còn bàn bên trong)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: { 200: { description: 'Đã xóa khu vực' } }
      }
    },
    '/tables': {
      get: {
        tags: ['Areas & Tables'],
        summary: 'Lấy danh sách bàn ăn kèm trạng thái và thông tin đơn hiện tại',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        responses: {
          200: {
            description: 'Danh sách bàn ăn',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    tables: { type: 'array', items: { $ref: '#/components/schemas/Table' } }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Areas & Tables'],
        summary: 'Thêm bàn mới vào khu vực',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['area_id', 'code', 'name'],
                properties: {
                  area_id: { type: 'integer', example: 1 },
                  code: { type: 'string', example: 'B12' },
                  name: { type: 'string', example: 'Bàn 12' },
                  seats: { type: 'integer', example: 4 },
                  sort_order: { type: 'integer', example: 12 }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Đã thêm bàn' } }
      }
    },
    '/tables/{id}': {
      put: {
        tags: ['Areas & Tables'],
        summary: 'Cập nhật thông tin bàn',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: { 200: { description: 'Đã cập nhật bàn' } }
      },
      delete: {
        tags: ['Areas & Tables'],
        summary: 'Xóa bàn (chỉ khi bàn trống và không gắn đơn hàng)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: { 200: { description: 'Đã xóa bàn' } }
      }
    },
    '/tables/{id}/status': {
      put: {
        tags: ['Areas & Tables'],
        summary: 'Cập nhật thủ công trạng thái bàn (EMPTY / OCCUPIED / RESERVED)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', example: 'RESERVED', enum: ['EMPTY', 'OCCUPIED', 'RESERVED'] }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Cập nhật trạng thái bàn thành công' } }
      }
    },
    '/tables/transfer': {
      post: {
        tags: ['Areas & Tables'],
        summary: 'Chuyển bàn (từ Bàn A sang Bàn B)',
        description: 'Chuyển toàn bộ đơn hàng đang ngồi từ bàn nguồn sang bàn đích trống. Bàn nguồn sẽ chuyển về EMPTY, bàn đích chuyển sang OCCUPIED.',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['from_table_id', 'to_table_id'],
                properties: {
                  from_table_id: { type: 'integer', example: 1, description: 'ID bàn nguồn có khách' },
                  to_table_id: { type: 'integer', example: 2, description: 'ID bàn đích đang trống' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Chuyển bàn thành công' },
          400: { description: 'Bàn đích đang có khách không thể chuyển' }
        }
      }
    },
    '/tables/merge': {
      post: {
        tags: ['Areas & Tables'],
        summary: 'Ghép bàn (Ghép Bàn A vào Bàn B)',
        description: 'Gộp toàn bộ món ăn từ đơn của bàn nguồn sang đơn của bàn đích. Cập nhật lại tổng tiền đơn đích, hủy đơn nguồn và giải phóng bàn nguồn.',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['source_table_id', 'target_table_id'],
                properties: {
                  source_table_id: { type: 'integer', example: 3, description: 'Bàn cần ghép vào' },
                  target_table_id: { type: 'integer', example: 4, description: 'Bàn đích giữ lại' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Ghép bàn thành công' } }
      }
    },

    // ------------------------------------------------------------------------
    // ORDERS & WORKFLOW
    // ------------------------------------------------------------------------
    '/orders': {
      get: {
        tags: ['Orders'],
        summary: 'Lấy danh sách đơn hàng',
        description: 'Lọc danh sách 50 đơn hàng mới nhất theo cửa hàng và trạng thái đơn.',
        parameters: [
          { $ref: '#/components/parameters/StoreIdHeader' },
          { name: 'store_id', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] } }
        ],
        responses: {
          200: {
            description: 'Danh sách đơn hàng',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    orders: { type: 'array', items: { $ref: '#/components/schemas/Order' } }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Orders'],
        summary: 'Tạo đơn hàng mới',
        description: 'Khởi tạo đơn hàng tại chỗ (DINE_IN) hoặc mang về/giao hàng (TAKEAWAY, DELIVERY). Kiểm tra tính hợp lệ của topping, cấu hình workflow và chuyển bàn sang OCCUPIED nếu là ăn tại bàn.',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateOrderRequest' }
            }
          }
        },
        responses: {
          201: {
            description: 'Tạo đơn hàng thành công',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Đã chuyển đơn đến bước: Bếp chế biến' },
                    order: { $ref: '#/components/schemas/Order' }
                  }
                }
              }
            }
          },
          400: { description: 'Dữ liệu đơn hàng hoặc món topping không hợp lệ' },
          403: { description: 'Vai trò hiện tại không được phép tạo đơn trong luồng quy trình' }
        }
      }
    },
    '/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Lấy chi tiết một đơn hàng',
        description: 'Bao gồm thông tin tổng quan, danh sách món kèm topping và lịch sử các lần thanh toán.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 101 } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: {
          200: {
            description: 'Chi tiết đơn hàng',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    order: { $ref: '#/components/schemas/Order' },
                    items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
                    payments: { type: 'array', items: { $ref: '#/components/schemas/Payment' } }
                  }
                }
              }
            }
          },
          404: { description: 'Không tìm thấy đơn hàng' }
        }
      }
    },
    '/orders/{id}/status': {
      put: {
        tags: ['Orders'],
        summary: 'Cập nhật trạng thái đơn (Hủy đơn hoặc Xác nhận đơn chờ duyệt)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', example: 'CANCELLED', enum: ['CANCELLED', 'CONFIRMED'] }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Cập nhật trạng thái đơn thành công' } }
      }
    },
    '/orders/{id}/advance': {
      post: {
        tags: ['Orders'],
        summary: 'Chuyển bước trong quy trình vận hành (Phê duyệt đơn hàng)',
        description: 'Dành cho các đơn có bước APPROVAL (ví dụ: quản lý duyệt đơn trước khi chuyển bếp).',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: { 200: { description: 'Đã chuyển đến bước tiếp theo' } }
      }
    },
    '/orders/{id}/split': {
      post: {
        tags: ['Orders'],
        summary: 'Tách hóa đơn (Split Bill)',
        description: 'Tách một hoặc nhiều món từ hóa đơn gốc sang một hóa đơn mới. Tự động tính toán lại tổng tiền cho cả 2 hóa đơn.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['item_ids'],
                properties: {
                  item_ids: { type: 'array', items: { type: 'integer' }, example: [15, 16], description: 'Danh sách order_item_id cần tách' }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Tách hóa đơn thành công',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Tách hóa đơn thành công' },
                    newOrder: { $ref: '#/components/schemas/Order' }
                  }
                }
              }
            }
          }
        }
      }
    },

    // ------------------------------------------------------------------------
    // PAYMENTS & VIETQR
    // ------------------------------------------------------------------------
    '/payments/process': {
      post: {
        tags: ['Payments'],
        summary: 'Thanh toán đơn hàng (Tiền mặt, QR, Chuyển khoản, Thẻ)',
        description: 'Xử lý thanh toán đơn hàng. Tự động tính tiền thối (nếu là tiền mặt), cập nhật trạng thái đơn sang PAID, giải phóng bàn (nếu có) và ghi nhận giao dịch.',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProcessPaymentRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'Thanh toán thành công',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Thanh toán thành công' },
                    payment: { $ref: '#/components/schemas/Payment' },
                    order: { $ref: '#/components/schemas/Order' },
                    change: { type: 'number', example: 30000 }
                  }
                }
              }
            }
          },
          400: { description: 'Số tiền thanh toán hoặc tiền khách đưa không hợp lệ' },
          409: { description: 'Đơn hàng đã thanh toán hoặc chưa tới bước thanh toán' }
        }
      }
    },
    '/payments/vietqr/{orderId}': {
      get: {
        tags: ['Payments'],
        summary: 'Sinh mã VietQR chuyển khoản ngân hàng động theo đơn',
        description: 'Tạo mã QR chuẩn VietQR (chuẩn NAPAS 247) chứa thông tin ngân hàng của cửa hàng, số tài khoản, số tiền chính xác của đơn và nội dung mã đơn hàng.',
        parameters: [
          { name: 'orderId', in: 'path', required: true, schema: { type: 'integer', example: 101 } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: {
          200: {
            description: 'Thông tin mã QR ngân hàng',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/VietQRResponse' }
              }
            }
          }
        }
      }
    },

    // ------------------------------------------------------------------------
    // KDS (KITCHEN DISPLAY SYSTEM)
    // ------------------------------------------------------------------------
    '/kds/orders': {
      get: {
        tags: ['KDS'],
        summary: 'Lấy danh sách các đơn cần chế biến cho bếp/bar',
        description: 'Hiển thị các đơn ở trạng thái CONFIRMED hoặc PREPARING, có thể lọc theo phân hệ bếp đồ ăn (KITCHEN) hoặc quầy pha chế (BAR).',
        parameters: [
          { $ref: '#/components/parameters/StoreIdHeader' },
          { name: 'kitchen_type', in: 'query', schema: { type: 'string', enum: ['KITCHEN', 'BAR'] }, description: 'Lọc theo bếp hoặc pha chế' }
        ],
        responses: { 200: { description: 'Danh sách đơn chế biến KDS' } }
      }
    },
    '/kds/history': {
      get: {
        tags: ['KDS'],
        summary: 'Lịch sử món ăn nhân viên bếp/bar hiện tại đã hoàn thành',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        responses: { 200: { description: 'Lịch sử hoàn thành món KDS' } }
      }
    },
    '/kds/completed-items': {
      get: {
        tags: ['KDS'],
        summary: 'Danh sách các món đã chế biến xong nhưng đơn chưa thanh toán',
        description: 'Phục vụ nhân viên phục vụ / chạy bàn kiểm tra các món đã sẵn sàng ra món cho khách.',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        responses: { 200: { description: 'Danh sách món hoàn thành chờ phục vụ' } }
      }
    },
    '/kds/items/{itemId}/status': {
      put: {
        tags: ['KDS'],
        summary: 'Cập nhật trạng thái chế biến của từng món (PENDING -> PREPARING -> READY -> SERVED)',
        description: 'Khi món chuyển sang READY, hệ thống tự động sinh thông báo bằng giọng nói (announcement) theo mẫu cấu hình của cửa hàng.',
        parameters: [
          { name: 'itemId', in: 'path', required: true, schema: { type: 'integer', example: 10 } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', example: 'READY', enum: ['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'] }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Cập nhật món thành công',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Cập nhật trạng thái món thành công' },
                    item: { type: 'object' },
                    order: { type: 'object' },
                    announcement: { type: 'string', example: 'Món ăn Gà Rán Giòn Cay, bàn B01 đã xong' }
                  }
                }
              }
            }
          },
          409: { description: 'Bước chuyển trạng thái không hợp lệ' }
        }
      }
    },

    // ------------------------------------------------------------------------
    // SHIFTS
    // ------------------------------------------------------------------------
    '/shifts/current': {
      get: {
        tags: ['Shifts'],
        summary: 'Lấy ca làm việc đang mở của thu ngân hiện tại',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        responses: {
          200: {
            description: 'Thông tin ca hiện tại',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    shift: { $ref: '#/components/schemas/Shift' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/shifts/open': {
      post: {
        tags: ['Shifts'],
        summary: 'Mở ca làm việc mới',
        parameters: [{ $ref: '#/components/parameters/StoreIdHeader' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  opening_cash: { type: 'number', example: 1000000, description: 'Số tiền mặt đầu ca bàn giao' },
                  notes: { type: 'string', example: 'Đầu ca sáng' }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Mở ca làm việc thành công' } }
      }
    },
    '/shifts/{id}/close': {
      post: {
        tags: ['Shifts'],
        summary: 'Kết ca / Đóng ca làm việc và đối soát tiền mặt',
        description: 'Thu ngân nhập số tiền mặt thực tế kiểm đếm được. Hệ thống tự động tính tổng tiền mặt bán được trong ca và tính chênh lệch thừa/thiếu.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['closing_cash'],
                properties: {
                  closing_cash: { type: 'number', example: 3500000, description: 'Số tiền mặt thực tế khi đếm cuối ca' },
                  notes: { type: 'string', example: 'Khớp tiền 100%' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Kết ca làm việc thành công' } }
      }
    },

    // ------------------------------------------------------------------------
    // REPORTS
    // ------------------------------------------------------------------------
    '/reports/summary': {
      get: {
        tags: ['Reports'],
        summary: 'Báo cáo tổng hợp doanh thu và số lượng bán',
        description: 'Thống kê tổng doanh thu, số lượng đơn hàng, giá trị đơn trung bình, phân bổ theo phương thức thanh toán và top 5 món bán chạy nhất.',
        parameters: [
          { $ref: '#/components/parameters/StoreIdHeader' },
          { name: 'range', in: 'query', schema: { type: 'string', default: 'today', enum: ['today', '7days', '30days'] }, description: 'Khoảng thời gian báo cáo' }
        ],
        responses: {
          200: {
            description: 'Báo cáo thống kê',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    revenue: { type: 'number', example: 12500000 },
                    orderCount: { type: 'integer', example: 85 },
                    avgOrderValue: { type: 'number', example: 147058 },
                    paymentBreakdown: {
                      type: 'object',
                      properties: {
                        CASH: { type: 'number', example: 5000000 },
                        QR: { type: 'number', example: 4500000 },
                        BANK_TRANSFER: { type: 'number', example: 2000000 },
                        CARD: { type: 'number', example: 1000000 }
                      }
                    },
                    topProducts: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          product_name: { type: 'string', example: 'Gà Rán Giòn Cay' },
                          total_qty: { type: 'integer', example: 42 },
                          total_revenue: { type: 'number', example: 1470000 }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    // ------------------------------------------------------------------------
    // INVENTORY
    // ------------------------------------------------------------------------
    '/inventory/summary': {
      get: {
        tags: ['Inventory'],
        summary: 'Báo cáo tổng hợp tồn kho hiện tại',
        description: 'Trả về tổng mặt hàng, tổng giá trị tồn kho theo giá vốn, số lượng mặt hàng sắp hết/cạn kho và danh sách tồn kho.',
        parameters: [
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: {
          200: {
            description: 'Tổng hợp tồn kho thành công'
          }
        }
      }
    },
    '/inventory/reports': {
      get: {
        tags: ['Inventory'],
        summary: 'Báo cáo thống kê Nhập - Xuất - Tồn theo từ ngày đến ngày',
        description: 'Thống kê tổng nhập, tổng xuất, chênh lệch tồn và bảng chi tiết biến động theo từng mặt hàng và theo ngày.',
        parameters: [
          { $ref: '#/components/parameters/StoreIdHeader' },
          { name: 'startDate', in: 'query', schema: { type: 'string', example: '2026-09-01' }, description: 'Từ ngày (YYYY-MM-DD)' },
          { name: 'endDate', in: 'query', schema: { type: 'string', example: '2026-09-20' }, description: 'Đến ngày (YYYY-MM-DD)' }
        ],
        responses: {
          200: {
            description: 'Báo cáo thống kê kho'
          }
        }
      }
    },
    '/inventory/items': {
      get: {
        tags: ['Inventory'],
        summary: 'Danh sách mặt hàng kho / nguyên vật liệu',
        description: 'Lấy danh sách mặt hàng kho của cửa hàng có tìm kiếm, lọc theo phân loại và lọc sắp hết hàng.',
        parameters: [
          { $ref: '#/components/parameters/StoreIdHeader' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Tìm theo mã hoặc tên' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Lọc theo nhóm hàng' },
          { name: 'low_stock', in: 'query', schema: { type: 'boolean' }, description: 'Chỉ lấy mặt hàng sắp hết' }
        ],
        responses: {
          200: { description: 'Danh sách mặt hàng kho' }
        }
      },
      post: {
        tags: ['Inventory'],
        summary: 'Thêm mới mặt hàng kho / nguyên vật liệu',
        parameters: [
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'name'],
                properties: {
                  code: { type: 'string', example: 'NL99' },
                  name: { type: 'string', example: 'Sốt tiêu đen đặc biệt' },
                  category: { type: 'string', example: 'Gia vị & Bột' },
                  unit: { type: 'string', example: 'Chai' },
                  cost_price: { type: 'number', example: 45000 },
                  current_stock: { type: 'number', example: 20 },
                  min_stock: { type: 'number', example: 5 }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Thêm mặt hàng kho thành công' }
        }
      }
    },
    '/inventory/items/{id}': {
      get: {
        tags: ['Inventory'],
        summary: 'Chi tiết mặt hàng kho',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: {
          200: { description: 'Chi tiết mặt hàng và lịch sử biến động' }
        }
      },
      put: {
        tags: ['Inventory'],
        summary: 'Cập nhật thông tin mặt hàng kho',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  name: { type: 'string' },
                  category: { type: 'string' },
                  unit: { type: 'string' },
                  cost_price: { type: 'number' },
                  min_stock: { type: 'number' },
                  is_active: { type: 'boolean' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Cập nhật thành công' }
        }
      },
      delete: {
        tags: ['Inventory'],
        summary: 'Xóa hoặc ẩn mặt hàng kho',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        responses: {
          200: { description: 'Đã xóa mặt hàng kho' }
        }
      }
    },
    '/inventory/transactions': {
      get: {
        tags: ['Inventory'],
        summary: 'Lịch sử phiếu giao dịch kho',
        parameters: [
          { $ref: '#/components/parameters/StoreIdHeader' },
          { name: 'startDate', in: 'query', schema: { type: 'string' } },
          { name: 'endDate', in: 'query', schema: { type: 'string' } },
          { name: 'item_id', in: 'query', schema: { type: 'integer' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['IN', 'OUT', 'ADJUST'] } }
        ],
        responses: {
          200: { description: 'Danh sách phiếu giao dịch kho' }
        }
      },
      post: {
        tags: ['Inventory'],
        summary: 'Lập phiếu kho (Nhập kho, Xuất kho, Cân bằng kiểm kê)',
        parameters: [
          { $ref: '#/components/parameters/StoreIdHeader' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['item_id', 'transaction_type', 'quantity'],
                properties: {
                  item_id: { type: 'integer', example: 1 },
                  transaction_type: { type: 'string', enum: ['IN', 'OUT', 'ADJUST'], example: 'IN' },
                  quantity: { type: 'number', example: 10 },
                  price: { type: 'number', example: 55000 },
                  note: { type: 'string', example: 'Nhập thêm từ nhà cung cấp' },
                  new_stock: { type: 'number', description: 'Số lượng tồn kiểm kê thực tế nếu là phiếu ADJUST' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Lập phiếu kho thành công' }
        }
      }
    },

    // ------------------------------------------------------------------------
    // ADMIN (SUPER ADMIN & ADMIN)
    // ------------------------------------------------------------------------
    '/admin/dashboard': {
      get: {
        tags: ['Admin'],
        summary: 'Dashboard tổng quan toàn hệ thống (Super Admin)',
        description: 'Thống kê số lượng chi nhánh đang hoạt động, người dùng, số đơn và doanh thu hôm nay / tháng này, kèm bảng xếp hạng doanh thu từng chi nhánh.',
        responses: {
          200: {
            description: 'Số liệu dashboard quản trị',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    activeStores: { type: 'integer', example: 5 },
                    activeUsers: { type: 'integer', example: 18 },
                    todayOrders: { type: 'integer', example: 142 },
                    todayRevenue: { type: 'number', example: 18500000 },
                    monthRevenue: { type: 'number', example: 420000000 },
                    stores: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer', example: 1 },
                          name: { type: 'string', example: 'OnesoftPOS - Chi nhánh 1' },
                          order_count: { type: 'integer', example: 85 },
                          revenue: { type: 'number', example: 12500000 }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Danh sách tất cả người dùng trong hệ thống',
        responses: { 200: { description: 'Danh sách người dùng và các cửa hàng phụ trách' } }
      },
      post: {
        tags: ['Admin'],
        summary: 'Tạo tài khoản người dùng mới',
        description: 'Tạo tài khoản và phân quyền vào một hoặc nhiều chi nhánh. Riêng STORE_MANAGER phải được gán vào chính xác 1 chi nhánh.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password', 'email', 'full_name'],
                properties: {
                  username: { type: 'string', example: 'manager_cn2' },
                  password: { type: 'string', example: '123456' },
                  email: { type: 'string', example: 'manager2@onesoftpos.vn' },
                  full_name: { type: 'string', example: 'Trần Văn Quản Lý' },
                  phone: { type: 'string', example: '0901112223' },
                  role: { type: 'string', example: 'STORE_MANAGER', enum: ['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER', 'ORDER_STAFF', 'CASHIER', 'KITCHEN'] },
                  status: { type: 'string', example: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE'] },
                  store_ids: { type: 'array', items: { type: 'integer' }, example: [2] },
                  completed_items_enabled: { type: 'boolean', example: true }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Tạo người dùng thành công' } }
      }
    },
    '/admin/users/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Cập nhật tài khoản người dùng',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  full_name: { type: 'string', example: 'Trần Văn Quản Lý Cũ' },
                  email: { type: 'string', example: 'manager2_new@onesoftpos.vn' },
                  phone: { type: 'string', example: '0909998887' },
                  role: { type: 'string', example: 'STORE_MANAGER' },
                  status: { type: 'string', example: 'ACTIVE' },
                  password: { type: 'string', example: 'newPassword123' },
                  store_ids: { type: 'array', items: { type: 'integer' }, example: [1] }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Cập nhật người dùng thành công' } }
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa tài khoản người dùng',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Đã xóa người dùng' } }
      }
    },
    '/admin/audit-logs': {
      get: {
        tags: ['Admin'],
        summary: 'Xem nhật ký thao tác hệ thống (Audit Logs)',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 }, description: 'Số bản ghi tối đa' }
        ],
        responses: { 200: { description: 'Nhật ký audit logs' } }
      },
      delete: {
        tags: ['Admin'],
        summary: 'Xóa toàn bộ nhật ký hệ thống',
        responses: { 200: { description: 'Đã xóa toàn bộ nhật ký' } }
      }
    },
    '/admin/role-features': {
      get: {
        tags: ['Admin'],
        summary: 'Lấy cấu hình phân quyền tính năng theo vai trò toàn hệ thống',
        responses: { 200: { description: 'Ma trận quyền toàn hệ thống' } }
      }
    },
    '/admin/role-features/{role}': {
      put: {
        tags: ['Admin'],
        summary: 'Cập nhật tính năng theo vai trò toàn hệ thống',
        parameters: [
          { name: 'role', in: 'path', required: true, schema: { type: 'string', enum: ['ADMIN', 'STORE_MANAGER', 'ORDER_STAFF', 'CASHIER', 'KITCHEN'] } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['feature_code', 'enabled'],
                properties: {
                  feature_code: { type: 'string', example: 'DISCOUNT' },
                  enabled: { type: 'boolean', example: true }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Đã cập nhật tính năng theo vai trò' } }
      }
    }
  }
};

/**
 * Custom modern CSS theme for Swagger UI
 * Đồng bộ màu sắc thương hiệu OnesoftPOS: Tông cam #ff7a00, xám đen sang trọng, badge sắc nét.
 */
const customCss = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

  :root {
    --onesoftpos-primary: #ff7a00;
    --onesoftpos-primary-hover: #e06a00;
    --onesoftpos-bg: #0f172a;
    --onesoftpos-card: #1e293b;
    --onesoftpos-text: #f8fafc;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    background-color: #f8fafc !important;
    color: #1e293b !important;
  }

  .swagger-ui .topbar {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
    border-bottom: 3px solid var(--onesoftpos-primary) !important;
    padding: 14px 0 !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  }

  .swagger-ui .topbar-wrapper img {
    content: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🍗</text></svg>') !important;
    width: 38px !important;
    height: 38px !important;
    margin-right: 12px !important;
  }

  .swagger-ui .topbar-wrapper a span {
    font-size: 20px !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    letter-spacing: -0.5px !important;
  }

  .swagger-ui .info {
    margin: 30px 0 20px 0 !important;
  }

  .swagger-ui .info .title {
    font-size: 32px !important;
    font-weight: 800 !important;
    color: #0f172a !important;
    letter-spacing: -1px !important;
  }

  .swagger-ui .info .version {
    background: linear-gradient(135deg, #ff7a00, #ea580c) !important;
    color: white !important;
    font-weight: 700 !important;
    padding: 4px 10px !important;
    border-radius: 9999px !important;
    font-size: 13px !important;
    display: inline-block !important;
  }

  .swagger-ui .btn.authorize {
    background: linear-gradient(135deg, #ff7a00, #ea580c) !important;
    color: white !important;
    border: none !important;
    border-radius: 8px !important;
    font-weight: 600 !important;
    padding: 8px 18px !important;
    box-shadow: 0 2px 8px rgba(255, 122, 0, 0.3) !important;
    transition: all 0.2s ease !important;
  }

  .swagger-ui .btn.authorize:hover {
    background: linear-gradient(135deg, #e06a00, #c2410c) !important;
    transform: translateY(-1px) !important;
  }

  .swagger-ui .btn.authorize svg {
    fill: white !important;
  }

  .swagger-ui .opblock {
    border-radius: 10px !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05) !important;
    margin-bottom: 14px !important;
    border-width: 1.5px !important;
  }

  .swagger-ui .opblock .opblock-summary-method {
    border-radius: 6px !important;
    font-weight: 700 !important;
    font-family: 'JetBrains Mono', monospace !important;
    padding: 6px 12px !important;
    min-width: 80px !important;
    text-align: center !important;
  }

  .swagger-ui .opblock .opblock-summary-path {
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 14px !important;
    font-weight: 600 !important;
  }

  .swagger-ui section.models {
    border-radius: 12px !important;
    border: 1px solid #e2e8f0 !important;
    background: white !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04) !important;
  }

  .swagger-ui section.models h4 {
    font-size: 18px !important;
    font-weight: 700 !important;
    color: #0f172a !important;
  }
`;

const swaggerUiOptions = {
  customCss,
  customSiteTitle: 'OnesoftPOS API Docs v1.0',
  customfavIcon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍗</text></svg>',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    docExpansion: 'list'
  }
};

module.exports = {
  swaggerSpec,
  customCss,
  swaggerUiOptions
};
