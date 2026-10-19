import { BrowserRouter, Routes, Route, useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { HomePage } from '@/pages/HomePage';
import { ShopPage } from '@/pages/ShopPage';
import { SuccessPage } from '@/pages/SuccessPage';
import { AuthScreen } from '@/components/AuthScreen';

// Routes the root path based on the ?payment= query param that Stripe appends
// on redirect. success renders the success page; cancelled clears the query
// and shows the shop; otherwise show the main feed (HomePage).
function RootRedirect() {
  const [searchParams] = useSearchParams();
  const payment = searchParams.get('payment');

  if (payment === 'success') return <SuccessPage />;
  if (payment === 'cancelled') return <Navigate to="/shop" replace />;
  return <HomePage />;
}

function LoginPage() {
  const navigate = useNavigate();
  return <AuthScreen onAuthed={() => navigate('/', { replace: true })} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
