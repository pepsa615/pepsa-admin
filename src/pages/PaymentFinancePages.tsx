import { Page } from '../components/Page.js';
import { ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { asRecords, scalar, type JsonRecord } from '../components/OpsUi.js';
import { api } from '../core/api.js';
import { useAsync } from '../core/useAsync.js';

const PLATFORM = 'pepsa-payment';

function value(row: JsonRecord, keys: string[]) {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null) return scalar(row[key]);
  return '—';
}

export function PaymentFinanceOverviewPage() {
  const result = useAsync(() => api.operation<JsonRecord>(PLATFORM, 'finance-overview'), []);
  const metrics = result.data ?? {};
  return <Page eyebrow="Pepsa Payment · Finance" title="Finance control plane" description="Authoritative exposure, statutory liability, settlement and reconciliation posture.">
    {result.loading ? <LoadingState /> : result.error ? <ErrorState error={result.error} retry={() => void result.reload()} /> :
      <div className="metric-grid">
        {[
          ['Principal value', 'principal_value'], ['Transactions', 'transaction_count'],
          ['Transfer fees', 'transfer_fees'], ['EMTL payable', 'levy_payable'],
          ['Pending exposure', 'pending_exposure'], ['Open breaks', 'open_reconciliation_cases'],
          ['Settlement pending', 'settlement_pending'], ['Settlement available', 'settlement_available'],
        ].map(([label, key]) => <article className="metric" key={key}><span>{label}</span><strong>{key.includes('count') || key.includes('cases') ? scalar(metrics[key]) : `₦${scalar(metrics[key])}`}</strong><small>As at {scalar(metrics.generated_at)}</small></article>)}
      </div>}
  </Page>;
}

type DataPageProps = { title: string; description: string; operation: string; root?: string; columns: Array<[string, string[]]> };
function FinanceDataPage({ title, description, operation, root, columns }: DataPageProps) {
  const result = useAsync(() => api.operation<unknown>(PLATFORM, operation), [operation]);
  const payload = result.data as JsonRecord | undefined;
  const rows = root && payload ? asRecords(payload[root]) : asRecords(result.data);
  return <Page eyebrow="Pepsa Payment · Finance" title={title} description={description}>
    {result.loading ? <LoadingState /> : result.error ? <ErrorState error={result.error} retry={() => void result.reload()} /> :
      <div className="table-wrap"><table aria-label={title}><thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((row, index) => <tr key={value(row, ['transaction_id','journal_id','run_id','policy_id','webhook_event_id','settlement_wallet_id']) + index}>
          {columns.map(([label, keys]) => <td key={label}>{label === 'Status' ? <StatusBadge value={value(row, keys)} /> : value(row, keys)}</td>)}
        </tr>) : <tr><td colSpan={columns.length}>No records for this view.</td></tr>}</tbody></table></div>}
  </Page>;
}

export const PaymentTransactionsPage = () => <FinanceDataPage title="Transaction explorer" description="Masked transaction evidence with stable references, fees and statutory levy attribution." operation="finance-transactions" root="data" columns={[["Reference",['transaction_id']],["Platform",['platform_name']],["Type",['type']],["Scope",['transfer_scope']],["Principal",['amount']],["Fee",['transfer_fee']],["EMTL",['statutory_levy']],["Status",['status']],["Created",['created_at']]]} />;
export const PaymentLedgerPage = () => <FinanceDataPage title="Ledger explorer" description="Append-only journals and balanced entries. Corrections require compensating journals." operation="finance-journals" columns={[["Journal",['journal_id']],["Reference",['reference']],["Type",['journal_type']],["Description",['description']],["Posted",['posted_at']]]} />;
export const PaymentLeviesPage = () => <FinanceDataPage title="Charges and levies" description="Effective-dated EMTL_NG policy versions. Activation and scope changes require maker-checker approval." operation="finance-levies" root="policies" columns={[["Code",['code']],["Version",['version']],["Amount",['amount']],["Threshold",['threshold']],["Payer",['payer']],["Status",['status']],["Effective",['effective_from']]]} />;
export const PaymentReconciliationPage = () => <FinanceDataPage title="Reconciliation" description="Immutable provider matching runs, exceptions and stale transfer exposure." operation="finance-reconciliation" root="runs" columns={[["Run",['run_id']],["Source",['source']],["Period from",['period_from']],["Period to",['period_to']],["Status",['status']],["Created",['created_at']]]} />;
export const PaymentSettlementsPage = () => <FinanceDataPage title="Settlements" description="Pending and settled balances with platform ownership and recent balance entries." operation="finance-settlements" columns={[["Wallet",['settlement_wallet_id']],["Pending",['pending_balance']],["Available",['settled_balance']],["Created",['created_at']]]} />;
export const PaymentProviderEventsPage = () => <FinanceDataPage title="Provider events and reports" description="Sanitized provider evidence, retry posture and references for financial investigation." operation="finance-provider-events" columns={[["Event",['webhook_event_id']],["Type",['event_type']],["Reference",['reference']],["Status",['processing_status']],["Attempts",['attempts']],["Error",['last_error_code']],["Received",['received_at']]]} />;
