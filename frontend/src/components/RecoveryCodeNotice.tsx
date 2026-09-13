/** Shows a recovery code exactly once, right after the server generated it — only its hash is
 * ever stored, so this is the one chance the user gets to see and save it. */
export default function RecoveryCodeNotice({ code, label }: { code: string; label: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
      <p className="text-xs font-medium text-amber-800">{label}</p>
      <p className="font-mono text-base tracking-wider text-amber-900 select-all">{code}</p>
      <p className="text-xs text-amber-700">
        บันทึกรหัสนี้ไว้ในที่ปลอดภัย จะไม่แสดงให้เห็นอีก — ใช้กู้คืนบัญชีได้ถ้าลืม PIN (ไม่ต้องจำ Shop ID ก็ได้)
      </p>
    </div>
  );
}
