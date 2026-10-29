import CustomerRecords from "../../../../../src/components/personal-admin/CustomerRecords";
export default async function Page({ params }: { params: Promise<{ customerId: string }> }) { const { customerId } = await params; return <CustomerRecords customerId={customerId} />; }
