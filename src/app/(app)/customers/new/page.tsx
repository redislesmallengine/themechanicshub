import { CustomerForm } from "@/components/customer-form";

export default function NewCustomerPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          New Customer
        </h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          You&apos;ll be able to register their equipment right after.
        </p>
      </div>
      <div className="max-w-2xl">
        <CustomerForm />
      </div>
    </div>
  );
}
