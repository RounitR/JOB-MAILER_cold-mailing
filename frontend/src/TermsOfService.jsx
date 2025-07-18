import React from "react";

export default function TermsOfService() {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded shadow p-8 mt-8 mb-16">
      <h1 className="text-3xl font-bold text-yellow-700 mb-4 flex items-center gap-2">
        <span className="material-icons text-yellow-700">gavel</span>
        Terms of Service
      </h1>
      <p className="mb-4">
        Welcome to Job Mailer! By using this app, you agree to the following terms and conditions. Please read them carefully.
      </p>
      <h2 className="text-xl font-bold text-yellow-700 mt-6 mb-2">1. Use of Service</h2>
      <p className="mb-4">
        You may use Job Mailer to manage contacts, upload resumes, and send emails for job search purposes. You must not use this app for spam, harassment, or any illegal activity.
      </p>
      <h2 className="text-xl font-bold text-yellow-700 mt-6 mb-2">2. Data Privacy</h2>
      <p className="mb-4">
        We respect your privacy. Please review our <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a> to understand how your data is collected, used, and protected.
      </p>
      <h2 className="text-xl font-bold text-yellow-700 mt-6 mb-2">3. Google Integration</h2>
      <p className="mb-4">
        By connecting your Google account, you grant Job Mailer permission to send emails on your behalf. We do not store your Google password. You can disconnect at any time.
      </p>
      <h2 className="text-xl font-bold text-yellow-700 mt-6 mb-2">4. Account Deletion</h2>
      <p className="mb-4">
        You may delete your account and all associated data at any time from your dashboard.
      </p>
      <h2 className="text-xl font-bold text-yellow-700 mt-6 mb-2">5. Disclaimer</h2>
      <p className="mb-4">
        This app is provided "as is" without warranty of any kind. We are not responsible for any loss or damage resulting from your use of Job Mailer.
      </p>
      <h2 className="text-xl font-bold text-yellow-700 mt-6 mb-2">6. Changes to Terms</h2>
      <p className="mb-4">
        We may update these Terms of Service from time to time. Significant changes will be communicated in-app.
      </p>
      <p className="text-gray-400 text-xs mt-8">Last updated: July 2024</p>
    </div>
  );
} 