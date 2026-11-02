'use client';

import { useCallback, useMemo } from 'react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import reminder from '@/lib/reminder';

const { formatMoney } = reminder;

ModuleRegistry.registerModules([AllCommunityModule]);

const STATUSES = ['draft', 'sent', 'paid', 'overdue'];

const DEFAULT_COL_DEF = {
  sortable: true,
  resizable: true,
  filter: true,
};

function OrderCellRenderer(props) {
  const data = props.data || props.params?.data;
  if (!data?.paypalOrderId) {
    return <span className="cell-muted">—</span>;
  }

  const isMock = Boolean(data.paypalMock) || String(data.paypalOrderId).startsWith('MOCK');
  const href = data.paypalLink || '#mock';
  const external = href.startsWith('http');

  return (
    <div className="order-cell">
      <div className="order-id-line">
        <code title={data.paypalOrderId}>{data.paypalOrderId}</code>
        {isMock ? <span className="mini-badge">mock</span> : null}
      </div>
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        {href === '#mock' ? 'mock link' : 'open checkout'}
      </a>
    </div>
  );
}

function ReminderCellRenderer(props) {
  const data = props.data || props.params?.data;
  const context = props.context || props.params?.context || {};

  if (!data) {
    return null;
  }
  if (data.status !== 'overdue') {
    return <span className="cell-muted">—</span>;
  }

  return (
    <button
      type="button"
      className="table-action"
      onClick={(event) => {
        event.stopPropagation();
        context.onDraftReminder?.(data);
      }}
    >
      Draft reminder
    </button>
  );
}

const columnDefs = [
  {
    field: 'clientName',
    headerName: 'Client',
    minWidth: 140,
    flex: 1,
  },
  {
    field: 'item',
    headerName: 'Item',
    minWidth: 180,
    flex: 1.8,
  },
  {
    field: 'amount',
    headerName: 'Amount',
    minWidth: 110,
    flex: 1,
    type: 'numericColumn',
    valueFormatter: (params) => formatMoney(params.value, params.data?.currency || 'USD'),
    cellClass: 'amount-cell',
  },
  {
    field: 'currency',
    headerName: 'Currency',
    width: 100,
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 124,
    editable: true,
    singleClickEdit: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: STATUSES },
    valueFormatter: (params) =>
      params.value ? params.value.charAt(0).toUpperCase() + params.value.slice(1) : '',
    cellClassRules: {
      'status-draft': (params) => params.value === 'draft',
      'status-sent': (params) => params.value === 'sent',
      'status-paid': (params) => params.value === 'paid',
      'status-overdue': (params) => params.value === 'overdue',
    },
  },
  {
    field: 'dueDate',
    headerName: 'Due',
    width: 118,
  },
  {
    colId: 'paypalOrder',
    headerName: 'PayPal Order',
    minWidth: 168,
    flex: 1.1,
    sortable: false,
    filter: false,
    cellRenderer: OrderCellRenderer,
  },
  {
    colId: 'action',
    headerName: 'Action',
    width: 152,
    sortable: false,
    filter: false,
    cellRenderer: ReminderCellRenderer,
  },
];

function getRowId(params) {
  return params.data.id;
}

export default function InvoiceGrid({ rows, onStatusChange, onDraftReminder }) {
  const gridContext = useMemo(() => ({ onDraftReminder }), [onDraftReminder]);

  const handleCellValueChanged = useCallback(
    (event) => {
      if (event.column?.getColId() !== 'status' || !event.data?.id) {
        return;
      }
      onStatusChange(event.data.id, event.newValue);
      event.api.refreshCells({
        rowNodes: [event.node],
        columns: ['status', 'action'],
        force: true,
      });
    },
    [onStatusChange]
  );

  return (
    <div className="ag-theme-alpine paidpilot-grid">
      <AgGridReact
        theme="legacy"
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={DEFAULT_COL_DEF}
        getRowId={getRowId}
        context={gridContext}
        rowHeight={54}
        headerHeight={44}
        animateRows
        onCellValueChanged={handleCellValueChanged}
      />
    </div>
  );
}
