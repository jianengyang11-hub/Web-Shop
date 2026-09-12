สร้างระบบ Core สำหรับ **AI Online Shop Operating System** ตาม Requirement ด้านล่าง

เป้าหมาย:
สร้างระบบร้านค้าออนไลน์ที่มี AI ช่วยตอบลูกค้า/สร้าง Order แต่ **เจ้าของร้านเป็นผู้ควบคุมการ Confirm Order และการตัด Stock**

## 1. Database Design

ออกแบบและ implement Database ให้รองรับอย่างน้อย:

### Products

* id
* name
* description
* price
* image
* status
* created_at
* updated_at

### Product Variants

* id
* product_id
* sku
* color
* size
* price_override (nullable)
* stock_quantity
* low_stock_threshold
* status

### Customers

* id
* name
* phone
* email
* channel
* channel_user_id
* created_at
* updated_at

### Orders

* id
* order_number
* customer_id
* status
* subtotal
* discount
* shipping_fee
* total
* note
* created_at
* updated_at
* confirmed_at
* cancelled_at

### Order Items

* id
* order_id
* product_id
* variant_id
* product_name_snapshot
* variant_snapshot
* unit_price
* quantity
* subtotal

สำคัญ:
Order Item ต้องเก็บ snapshot ของชื่อ/ราคา/variant ตอนสร้าง Order เพื่อป้องกัน Product ถูกแก้ภายหลังแล้ว Order เก่าเปลี่ยนตาม

### Order Status

ใช้:

NEW
PENDING_CONFIRMATION
CONFIRMED
PREPARING
SHIPPED
DELIVERED
CANCELLED
REJECTED

## 2. Stock Business Rule — สำคัญที่สุด

ห้ามตัด Stock ตอน AI สร้าง Order

ห้ามตัด Stock ตอนลูกค้าส่ง Order

Stock จะถูกตัด **เฉพาะตอน Owner กด Confirm Order**

Flow:

Customer
→ AI
→ Create Order
→ PENDING_CONFIRMATION
→ Owner Dashboard
→ Confirm
→ ตรวจ Stock ล่าสุด
→ ถ้า Stock เพียงพอ
→ Transaction ตัด Stock
→ Order = CONFIRMED

ถ้า Stock ไม่พอ:

* ห้าม Confirm
* ห้ามตัด Stock
* แจ้ง Owner ว่า Stock ไม่เพียงพอ
* Order ยังคง PENDING_CONFIRMATION

ต้องป้องกัน Stock ติดลบและ race condition ด้วย Database Transaction / row locking หรือกลไกที่เหมาะสม

ถ้า Reject:

* ไม่ตัด Stock
* Order = REJECTED

## 3. API Design

สร้าง REST API ที่ชัดเจน

### Products

GET /api/products
POST /api/products
GET /api/products/{id}
PUT /api/products/{id}
DELETE /api/products/{id}

### Variants / Stock

GET /api/products/{id}/variants
POST /api/products/{id}/variants
PUT /api/variants/{id}
DELETE /api/variants/{id}

GET /api/stock
GET /api/stock/low
PUT /api/variants/{id}/stock

### Customers

GET /api/customers
GET /api/customers/{id}

### Orders

GET /api/orders
GET /api/orders/{id}
POST /api/orders

POST /api/orders/{id}/confirm
POST /api/orders/{id}/reject

POST /api/orders/{id}/preparing
POST /api/orders/{id}/shipped
POST /api/orders/{id}/delivered

API ต้อง validate Order State Transition

ตัวอย่าง:
PENDING_CONFIRMATION → CONFIRMED ✅
CONFIRMED → PREPARING ✅
PREPARING → SHIPPED ✅
SHIPPED → DELIVERED ✅

แต่:

DELIVERED → CONFIRMED ❌
CANCELLED → CONFIRMED ❌
REJECTED → CONFIRMED ❌

## 4. Order State Machine

สร้าง State Machine กลาง อย่ากระจาย logic ไว้หลายจุด

รองรับ:

NEW
↓
PENDING_CONFIRMATION
↓
CONFIRMED
↓
PREPARING
↓
SHIPPED
↓
DELIVERED

และ:

PENDING_CONFIRMATION → REJECTED
CONFIRMED → CANCELLED (เฉพาะตาม business rule ที่เหมาะสม)

ทุก transition ต้อง validate ก่อนเปลี่ยนสถานะ

## 5. Owner Dashboard

สร้าง Dashboard สำหรับเจ้าของร้าน

หน้า Overview แสดง:

* New Orders
* Pending Confirmation
* Confirmed Orders
* Today's Sales
* Total Products
* Low Stock
* Recent Orders

### Orders Page

แสดง:

* Order Number
* Customer
* Items
* Total
* Status
* Created Time

สำหรับ PENDING_CONFIRMATION ให้มี:

[ Confirm ] [ Reject ]

เมื่อกด Confirm:

1. Backend ตรวจ Stock
2. Transaction
3. ตัด Stock
4. เปลี่ยน Order เป็น CONFIRMED
5. บันทึก confirmed_at
6. ส่ง event สำหรับ Notification
7. Dashboard refresh

### Product Page

สามารถ:

* Add Product
* Edit Product
* Delete Product
* Add Variant
* Edit Variant
* Update Stock

แสดง:

Product
SKU
Color
Size
Price
Stock
Low Stock Status

### Stock Page

แสดง:

* Current Stock
* Low Stock
* Out of Stock

## 6. AI Integration Boundary

AI ต้องอ่านข้อมูล Product/Stock จาก Database/API

AI สามารถ:

* ตอบคำถามสินค้า
* เช็ค Stock
* แนะนำสินค้า
* แนะนำ Variant
* สร้าง Order
* ส่ง Order เข้า PENDING_CONFIRMATION

AI ห้าม:

* Confirm Order
* ตัด Stock
* เปลี่ยน Stock
* เปลี่ยนราคา
* Reject Order
* เปลี่ยน Order Status โดยตรง

Owner เท่านั้นที่สามารถ Confirm Order

## 7. Notification Architecture

อย่าผูกระบบ Core กับ LINE/Facebook/Telegram โดยตรง

สร้าง Notification Service / Interface ก่อน

ตัวอย่าง:

Order Confirmed
→ Order Event
→ Notification Service
→ Channel Adapter

ตอนนี้สามารถทำ Mock Notification ได้ก่อน

ภายหลังค่อยต่อ:

* LINE
* Facebook Messenger
* Telegram

## 8. Architecture

แยก Layer ให้ชัด:

Frontend
↓
REST API
↓
Service Layer
↓
Business Rules / State Machine
↓
Repository / ORM
↓
Database

อย่าใส่ Business Logic สำคัญไว้ใน Frontend

โดยเฉพาะ Stock deduction และ Order confirmation ต้องอยู่ Backend

## 9. Testing

สร้าง Automated Tests สำหรับ:

### Product

* Create
* Update
* Delete
* Variant

### Order

* Create Order
* Pending Confirmation
* Confirm
* Reject
* Status transitions

### Stock

* Confirm แล้ว Stock ลดถูกต้อง
* Reject แล้ว Stock ไม่ลด
* Stock ไม่พอ → Confirm ไม่ได้
* Stock ห้ามติดลบ
* Concurrent Confirm ต้องไม่ทำให้ Stock ติดลบ
* Confirm Order ซ้ำต้องไม่ตัด Stock ซ้ำ

### Example

Stock = 10

Order quantity = 2

ก่อน Confirm:
Stock = 10

หลัง Confirm:
Stock = 8

ถ้า Reject:
Stock = 10

ถ้า Stock = 1 แต่ Order = 2:
Confirm = ERROR
Stock = 1
Order = PENDING_CONFIRMATION

## 10. Implementation Rules

ก่อนแก้ไข code:

1. ตรวจสอบ repository ปัจจุบัน
2. ตรวจสอบ existing architecture
3. ตรวจสอบ Database ที่มีอยู่
4. ตรวจสอบ API ที่มีอยู่
5. ตรวจสอบ frontend ที่มีอยู่
6. อย่าสร้าง architecture ซ้ำกับของเดิม
7. Reuse existing code เมื่อเหมาะสม
8. อย่าลบ feature เดิมโดยไม่มีเหตุผล

ถ้าพบว่า architecture ปัจจุบันไม่ตรงกับ requirement ให้เสนอ migration plan ก่อนแก้ส่วนใหญ่

## 11. Deliverables

ทำงานให้ครบ:

1. Database schema / migrations
2. Models
3. Repositories
4. Services
5. Order State Machine
6. Stock transaction logic
7. REST APIs
8. Dashboard UI
9. Product Management UI
10. Stock Management UI
11. Order Management UI
12. Notification interface/mock
13. Automated tests
14. API documentation
15. Architecture documentation

## 12. Definition of Done

ระบบต้องสามารถทำ Flow นี้ได้จริง:

Customer
→ AI สอบถามสินค้า
→ AI ตรวจ Product/Stock
→ Customer สร้าง Order
→ Order = PENDING_CONFIRMATION
→ Owner เปิด Dashboard
→ Owner กด Confirm
→ Backend ตรวจ Stock
→ Transaction ตัด Stock
→ Order = CONFIRMED
→ Notification Event
→ Customer ได้รับการแจ้งเตือน

และต้องพิสูจน์ด้วย Automated Tests ว่า:

"Stock จะไม่ถูกตัดจนกว่า Owner จะกด Confirm"

อย่าเพิ่มระบบ Payment, Shipping Integration, CRM, Advanced Analytics หรือ AI Agent ซับซ้อนใน Phase นี้

โฟกัสที่ Core Order + Product + Stock + Dashboard ให้เสร็จและเสถียรก่อน

หลัง implementation:

* run tests
* report test result
* report files changed
* report database changes
* report API endpoints
* report remaining TODO
* ห้ามอ้างว่า feature เสร็จถ้ายังไม่ได้ test จริง
