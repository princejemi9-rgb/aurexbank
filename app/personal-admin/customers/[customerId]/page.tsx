import Link from "next/link";
import CustomerManager from "../../../../src/components/personal-admin/CustomerManager";
export default async function Page({ params }: { params: Promise<{ customerId: string }> }) { const { customerId } = await params; return <><div className="bank-shell px-4 pt-4 text-white sm:px-8"><Link href={`/personal-admin/customers/${customerId}/records`} className="bank-button inline-block rounded-lg px-3 py-2 text-sm font-bold">Customer records, documents & verification</Link></div><CustomerManager customerId={customerId} /></>; }
