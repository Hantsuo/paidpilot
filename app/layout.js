import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './globals.css';

export const metadata = {
  title: 'PaidPilot — AI payment agent for solo devs',
  description:
    'Paste a client message, extract an invoice, create a PayPal Sandbox order, and draft polite payment reminders.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
