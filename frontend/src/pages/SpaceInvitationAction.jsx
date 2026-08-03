import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;
  const message = error?.response?.data?.message;

  if (message) return message;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (detail?.message) return detail.message;

  return 'Unable to handle this invitation link. Please try again.';
}

function routeFromRedirectUrl(redirectUrl) {
  if (!redirectUrl) return '';

  try {
    const parsed = new URL(redirectUrl, window.location.origin);
    if (parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return redirectUrl;
  } catch {
    return redirectUrl;
  }
}

export default function SpaceInvitationAction() {
  const { token, action } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({
    status: 'loading',
    title: 'Handling invitation',
    message: 'Please wait while TaskFlow processes your invitation.',
    redirectUrl: '',
  });

  useEffect(() => {
    let isMounted = true;

    const handleInvitation = async () => {
      const normalizedAction = String(action || '').toLowerCase();
      const apiAction = normalizedAction === 'accept'
        ? 'approve'
        : normalizedAction === 'decline'
          ? 'reject'
          : '';

      if (!token || !apiAction) {
        setState({
          status: 'error',
          title: 'Invalid invitation link',
          message: 'This invitation link is incomplete or invalid.',
          redirectUrl: '',
        });
        return;
      }

      try {
        const response = await axiosClient.get(
          `/spaces/member-requests/${encodeURIComponent(token)}/${apiAction}`,
          {
            params: { response: 'json' },
            skipAuthRefresh: true,
          }
        );

        if (!isMounted) return;

        const redirectUrl = routeFromRedirectUrl(response.data?.redirect_url || '');
        setState({
          status: 'success',
          title: response.data?.title || 'Invitation handled',
          message: response.data?.message || 'Your invitation has been processed.',
          redirectUrl,
        });

        if (redirectUrl) {
          window.setTimeout(() => {
            if (/^https?:\/\//i.test(redirectUrl)) {
              window.location.assign(redirectUrl);
            } else {
              navigate(redirectUrl, { replace: true });
            }
          }, 1200);
        }
      } catch (error) {
        if (!isMounted) return;
        setState({
          status: 'error',
          title: 'Unable to handle invitation',
          message: getErrorMessage(error),
          redirectUrl: '',
        });
      }
    };

    void handleInvitation();

    return () => {
      isMounted = false;
    };
  }, [action, navigate, token]);

  const isLoading = state.status === 'loading';
  const isError = state.status === 'error';

  return (
    <div className="min-h-screen bg-white px-6 py-10 font-sans text-slate-900">
      <main className="mx-auto flex min-h-[70vh] max-w-[720px] items-center justify-center">
        <section className="w-full overflow-hidden rounded-2xl border border-[#E0D7F0] bg-white shadow-[0_16px_42px_rgba(76,43,116,0.12)]">
          <header className="border-b border-[#E0D7F0] bg-[#FAF8FF] px-8 py-6">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[28px] font-extrabold leading-none text-[#4C2B74]">TaskFlow</div>
              <span className="rounded-full bg-[#F0EDFF] px-4 py-2 text-xs font-extrabold text-[#5B3A7A]">
                Invitation
              </span>
            </div>
          </header>

          <div className="px-8 py-8">
            <div className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full ${
              isLoading
                ? 'bg-[#F0EDFF] text-[#5B3A7A]'
                : isError
                  ? 'bg-red-50 text-red-700'
                  : 'bg-green-50 text-green-700'
            }`}>
              <span className={`material-symbols-outlined text-[24px] ${isLoading ? 'animate-pulse' : ''}`}>
                {isLoading ? 'hourglass_top' : isError ? 'error' : 'check_circle'}
              </span>
            </div>

            <h1 className="mb-3 text-[28px] font-extrabold leading-tight text-[#0f172a]">
              {state.title}
            </h1>
            <p className="mb-6 max-w-[560px] text-sm leading-6 text-slate-600">
              {state.message}
            </p>

            {state.redirectUrl ? (
              <p className="text-xs font-semibold text-[#6E5A8A]">
                Redirecting you to TaskFlow...
              </p>
            ) : (
              <Link
                to="/"
                className="inline-flex rounded-lg bg-[#6B4A91] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#5B3A7A]"
              >
                Open TaskFlow
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
