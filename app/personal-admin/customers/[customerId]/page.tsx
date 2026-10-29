import CustomerManager from "../../../../src/components/personal-admin/CustomerManager";
export default async function Page({ params }: { params: Promise<{ customerId: string }> }) { const { customerId } = await params; return <CustomerManager customerId={customerId} />; }
