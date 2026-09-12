## Mobile + Web Dashboard Requirement

ระบบต้องรองรับ Owner 2 รูปแบบ:

1. Mobile-first สำหรับร้านเล็ก
2. Full Web Dashboard สำหรับร้านที่มี Computer

ทั้งสองระบบต้องใช้ Backend API และ Database เดียวกัน

Mobile ต้องสามารถ:
- ดู New Orders
- ดู Order Detail
- Confirm Order
- Reject Order
- ดู Stock
- ดู Low Stock
- ดู Sales Summary
- เปลี่ยน Order Status
- รับ Notifications

Web Dashboard ต้องสามารถ:
- Dashboard Overview
- Orders
- Products
- Product Variants
- Stock
- Customers
- Sales
- AI Conversations
- Notifications
- Settings

ห้ามสร้าง Business Logic แยกกันระหว่าง Mobile และ Web

Business Logic ทั้งหมดต้องอยู่ Backend

โดยเฉพาะ:
- Order Confirmation
- Stock Validation
- Stock Deduction
- Order State Transition

ต้องทำผ่าน Backend API เดียวกัน

Design ต้องเป็น Mobile-first และ Responsive

ร้านเล็กต้องสามารถใช้งานระบบด้วย Smartphone เพียงเครื่องเดียว + Internet ได้

ไม่บังคับให้ร้านมี Computer
ไม่บังคับให้มี Printer
ไม่บังคับให้มี Barcode Scanner
ไม่บังคับให้ซื้อ Hardware เพิ่ม