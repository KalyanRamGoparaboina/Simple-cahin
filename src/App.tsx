import { useState } from 'react';
import {
  Server,
  Smartphone,
  GitBranch,
  Database,
  CloudLightning,
  CheckCircle2,
  Terminal,
  Shield,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Zap,
  RefreshCw,
  Users,
} from 'lucide-react';

// ─── YAML constant (no JSX risk) ───────────────────────────────────────────
const YAML_CODE = `name: Deploy SymFlow

on:
  push:
    branches: [staging, main]

env:
  BRANCH: \${{ github.ref_name }}

jobs:
  # ── 1. Run Tests ─────────────────────────────────────────
  test:
    name: Test Suite
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: symflow_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt
      - run: python manage.py test --settings=config.settings.test
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci && npm run test -- --watchAll=false

  # ── 2. Build & Deploy ────────────────────────────────────
  deploy:
    name: Deploy (\${{ github.ref_name }})
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build React Frontend
        run: |
          cd frontend
          npm ci
          REACT_APP_ENV=\${{ env.BRANCH }} npm run build

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id:     \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1

      - name: Push to S3
        run: |
          BUCKET="symflow-\${{ env.BRANCH }}-static"
          aws s3 sync frontend/build s3://\$BUCKET --delete
          aws cloudfront create-invalidation \\
            --distribution-id \${{ env.BRANCH == 'main' && secrets.CF_PROD_ID || secrets.CF_STAGING_ID }} \\
            --paths "/*"

      - name: SSH Deploy to EC2
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: \${{ env.BRANCH == 'main' && secrets.PROD_EC2_HOST || secrets.STAGING_EC2_HOST }}
          username: ubuntu
          key:  \${{ secrets.EC2_SSH_KEY }}
          script: |
            set -e
            cd /var/www/symflow-backend
            git fetch origin && git checkout \${{ env.BRANCH }} && git pull
            source venv/bin/activate
            pip install -r requirements.txt --quiet
            python manage.py migrate --noinput
            python manage.py collectstatic --noinput
            sudo systemctl restart gunicorn celery celerybeat nginx
            echo "✓ Deployed \${{ env.BRANCH }} at \$(date)"`;

// ─── Reusable helpers ──────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all duration-200 border border-slate-700"
    >
      {copied ? (
        <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!</>
      ) : (
        <><Copy className="w-3.5 h-3.5" /> Copy</>
      )}
    </button>
  );
}

function SectionBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${color}`}>
      {label}
    </span>
  );
}

function Card({ children, className = '', glow = '' }: { children: React.ReactNode; className?: string; glow?: string }) {
  return (
    <div className={`relative bg-slate-900/60 border border-slate-800 rounded-2xl p-7 backdrop-blur-xl transition-all duration-300 hover:border-slate-700 overflow-hidden group ${className}`}>
      {glow && <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${glow}`} />}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function CardHeader({ icon, color, title, badge }: { icon: React.ReactNode; color: string; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`p-3 rounded-xl ${color} shrink-0`}>{icon}</div>
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
      </div>
      {badge}
    </div>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-slate-300 text-sm">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function CommandBlock({ command, color = 'text-emerald-300' }: { command: string; color?: string }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
      <Terminal className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
      <code className={`text-sm font-mono ${color} flex-1 break-all`}>{command}</code>
      <CopyButton text={command} />
    </div>
  );
}

// ─── Accordion ─────────────────────────────────────────────────────────────
function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-900/60 hover:bg-slate-800/60 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-slate-300">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && (
        <div className="px-5 py-4 bg-slate-950/40 border-t border-slate-800 text-sm text-slate-400 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── PART 1 ────────────────────────────────────────────────────────────────
function Part1() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <SectionBadge label="40% Weightage" color="text-blue-400 border-blue-500/30 bg-blue-500/10" />
        </div>
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
          Shared Gateway Problem
        </h2>
        <p className="text-slate-400 mt-2">Request pooling, fair queueing, and rate-limiting across 25 tenants — 20+ req/sec into a 3 req/sec ceiling.</p>
      </div>

      {/* Architecture Flow */}
      <Card glow="bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
        <CardHeader icon={<Server className="w-5 h-5" />} color="bg-blue-500/20 text-blue-400" title="Architecture — Redis-backed Tenant Queues" />
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {[
            { label: 'Django API', sub: 'Enqueue & 202 ack', color: 'bg-blue-500/10 border-blue-500/30 text-blue-300' },
            { label: '→', sub: '', color: 'border-0 bg-transparent text-slate-600 text-xl' },
            { label: 'Redis Queues', sub: 'Per-tenant list', color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' },
            { label: '→', sub: '', color: 'border-0 bg-transparent text-slate-600 text-xl' },
            { label: 'Dispatcher Worker', sub: 'Round-robin + Token Bucket', color: 'bg-purple-500/10 border-purple-500/30 text-purple-300' },
            { label: '→', sub: '', color: 'border-0 bg-transparent text-slate-600 text-xl' },
            { label: 'External API', sub: '≤ 3 req/sec', color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' },
          ].map((item, i) => (
            item.sub ? (
              <div key={i} className={`flex flex-col items-center px-4 py-3 rounded-xl border ${item.color}`}>
                <span className="text-xs font-semibold">{item.label}</span>
                <span className="text-xs text-slate-500 mt-0.5">{item.sub}</span>
              </div>
            ) : (
              <span key={i} className="text-slate-600 text-lg font-bold">{item.label}</span>
            )
          ))}
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">
          On receiving an API request, Django immediately pushes it to{' '}
          <code className="bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 text-xs">queue:tenant:{'{id}'}</code> in
          Redis and returns <code className="bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 text-xs">202 Accepted</code>.
          No new AWS services — ElastiCache is already in the stack.
        </p>
      </Card>

      {/* Rate Enforcement */}
      <Card glow="bg-gradient-to-br from-cyan-500/5 to-emerald-500/5">
        <CardHeader
          icon={<Zap className="w-5 h-5" />}
          color="bg-cyan-500/20 text-cyan-400"
          title="Rate Enforcement — Token Bucket in Redis (Lua)"
          badge={<SectionBadge label="Exactly ≤ 3/sec" color="text-emerald-400 border-emerald-500/30 bg-emerald-500/10" />}
        />
        <ul className="space-y-2.5 mb-4">
          <CheckItem>A global bucket holds max 3 tokens; refills 3 tokens every 1 second using a sliding-window timestamp.</CheckItem>
          <CheckItem>The dispatcher runs a Lua script (<code className="bg-slate-800 px-1 rounded text-cyan-300 text-xs">EVAL</code>) atomically to acquire a token before each external call — no race condition even with multiple workers.</CheckItem>
          <CheckItem>Alternative quick win: one dedicated Celery worker with <code className="bg-slate-800 px-1 rounded text-cyan-300 text-xs">rate_limit='3/s'</code> — simpler but not horizontally scalable.</CheckItem>
        </ul>
        <CommandBlock command="# Redis Lua: acquire 1 token atomically from rate:global" color="text-cyan-300" />
        <CommandBlock command="EVAL script 1 rate:global  # returns 1=ok, 0=throttled" color="text-cyan-300" />
      </Card>

      {/* Fairness */}
      <Card glow="bg-gradient-to-br from-purple-500/5 to-violet-500/5">
        <CardHeader icon={<Users className="w-5 h-5" />} color="bg-purple-500/20 text-purple-400" title="Fairness — Round-Robin Dispatcher" />
        <p className="text-slate-300 text-sm leading-relaxed mb-4">
          The dispatcher cycles through all active tenant queue keys in a round-robin loop, popping{' '}
          <strong>one request per rotation</strong>. Customer B's single request is served in the very next cycle
          regardless of Customer A's 100-item backlog.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { tenant: 'Tenant A', count: 100, bar: 'w-full', color: 'bg-red-500/60' },
            { tenant: 'Tenant B', count: 1, bar: 'w-1', color: 'bg-emerald-500/60' },
            { tenant: 'Tenant C', count: 12, bar: 'w-1/4', color: 'bg-blue-500/60' },
          ].map(({ tenant, count, bar, color }) => (
            <div key={tenant} className="bg-slate-950 rounded-xl p-3 border border-slate-800">
              <div className="text-xs font-medium text-slate-400 mb-2">{tenant}</div>
              <div className="text-2xl font-bold text-slate-200 mb-2">{count}</div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${bar} ${color} rounded-full`} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-slate-500 text-xs mt-3">↑ Tenant B is served next cycle despite Tenant A's flood</p>
      </Card>

      {/* Retry */}
      <Card className="border-l-4 border-l-orange-500" glow="bg-gradient-to-br from-orange-500/5 to-red-500/5">
        <CardHeader icon={<RefreshCw className="w-5 h-5" />} color="bg-orange-500/20 text-orange-400" title="Failure Handling — Exponential Backoff + Full Jitter" />
        <p className="text-slate-300 text-sm leading-relaxed mb-4">
          On 5xx, the task requeues with: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-orange-300 text-xs">delay = random(0, min(cap, base × 2ⁿ))</code>.
          Jitter prevents the Thundering Herd. After 5 retries, the task is pushed to a Dead Letter Queue for manual review.
        </p>
        <div className="flex gap-2 flex-wrap">
          {['2s', '4s', '8s', '16s', '32s', '→ DLQ'].map((v, i) => (
            <div key={i} className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border ${i === 5 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-orange-500/10 border-orange-500/30 text-orange-300'}`}>
              {i < 5 ? `Retry ${i + 1}: ${v}` : v}
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        <Accordion title="Why not just use a single global queue?">
          A single global FIFO queue is unfair by design — one tenant flooding 100 requests will block all others until those 100 complete. Per-tenant queues with round-robin polling provide O(active_tenants) fair-share access regardless of individual queue depth.
        </Accordion>
        <Accordion title="Why Redis over SQS or RabbitMQ?">
          The stack already has ElastiCache (Redis) running. Introducing SQS or RabbitMQ adds operational overhead, cost, and new failure modes. The built-in Celery + Redis integration (already used in SymFlow) is the most practical, cost-conscious choice.
        </Accordion>
      </div>
    </div>
  );
}

// ─── PART 2 ────────────────────────────────────────────────────────────────
function Part2() {
  const [selectedStack, setSelectedStack] = useState<'rn' | 'native'>('rn');

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <SectionBadge label="20% Weightage" color="text-emerald-400 border-emerald-500/30 bg-emerald-500/10" />
        </div>
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-300">
          Mobile Architecture
        </h2>
        <p className="text-slate-400 mt-2">A fluid, low-friction mobile SymFlow — optimised for warehouse and logistics use.</p>
      </div>

      <Card glow="bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
        <CardHeader icon={<Smartphone className="w-5 h-5" />} color="bg-emerald-500/20 text-emerald-400" title="Interaction Model — Hybrid Click + Contextual NLP" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 border-l-4 border-l-emerald-500">
            <h4 className="text-sm font-semibold text-emerald-400 mb-2">Primary — Click UI</h4>
            <p className="text-xs text-slate-400 leading-relaxed">Large tap targets (min 48px), high-contrast scan for POD upload, one-tap delivery confirmation. Optimised for gloves and bright outdoor conditions.</p>
          </div>
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 border-l-4 border-l-teal-500">
            <h4 className="text-sm font-semibold text-teal-400 mb-2">Secondary — "Ask SymAI" FAB</h4>
            <p className="text-xs text-slate-400 leading-relaxed">Floating Action Button opens NLP input. Voice (push-to-talk) or text. Example: <em className="text-teal-400">"How many pending deliveries in Zone 4?"</em></p>
          </div>
        </div>
        <p className="text-slate-400 text-xs">Speech is off by default to protect privacy; push-to-talk only. Offline-first with SQLite sync.</p>
      </Card>

      {/* Stack toggle */}
      <Card>
        <CardHeader icon={<Database className="w-5 h-5" />} color="bg-teal-500/20 text-teal-400" title="Tech Stack Comparison" />
        <div className="flex gap-2 mb-5">
          {[
            { key: 'rn', label: 'React Native (Recommended)' },
            { key: 'native', label: 'Native (Kotlin/Swift)' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedStack(key as 'rn' | 'native')}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                selectedStack === key
                  ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                  : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedStack === 'rn' ? (
          <div className="space-y-4">
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong>React Native (Expo SDK 52)</strong> is the recommendation. The frontend team already uses
              React + Tailwind — React Native shares up to 80% of hooks, API clients, and Zustand state. Expo EAS
              handles OTA updates, removing the need for App Store releases for bug-fixes.
            </p>
            <div className="flex flex-wrap gap-2">
              {['React Native', 'Expo EAS', 'React Query', 'Zustand', 'NativeWind', 'SQLite (offline)'].map(t => (
                <span key={t} className="px-3 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full text-xs font-medium text-teal-300">{t}</span>
              ))}
            </div>
            <ul className="space-y-2 mt-2">
              <CheckItem>Shared codebase with existing React frontend (80% reuse)</CheckItem>
              <CheckItem>Expo EAS — OTA updates without App Store approval delays</CheckItem>
              <CheckItem>NativeWind brings Tailwind classes directly into mobile</CheckItem>
              <CheckItem>Native camera/biometric modules available via bare workflow</CheckItem>
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong>Native (Kotlin for Android / Swift for iOS)</strong> gives maximum performance and full platform API access. Ideal if the app requires intensive graphics, Bluetooth, or advanced camera processing that React Native can't handle.
            </p>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
              <p className="text-orange-300 text-xs font-semibold mb-1">Trade-offs to consider:</p>
              <ul className="space-y-1.5">
                {['Two separate codebases (Android + iOS)', 'No shared logic with existing React frontend', 'Requires separate Kotlin and Swift expertise', 'Slower iteration — no OTA updates'].map(t => (
                  <li key={t} className="text-xs text-orange-200 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-orange-400 shrink-0" />{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <Accordion title="What about Flutter?">
          Flutter is a solid choice — single codebase, excellent performance, strong community. The deciding factor is team expertise. Since the SymFlow team is React-fluent, React Native gives a shorter ramp-up. If the team had Flutter experience, it would be equally valid.
        </Accordion>
        <Accordion title="How does SymAI integrate on mobile?">
          The same SymAI API endpoints (via DRF) used on the web platform are called from mobile. Speech-to-text can use device-native APIs (expo-speech) feeding into the NLP endpoint. No additional Bedrock integration is needed on the client side.
        </Accordion>
      </div>
    </div>
  );
}

// ─── PART 3 ────────────────────────────────────────────────────────────────
function Part3() {
  const [activeEnhancement, setActiveEnhancement] = useState<'docker' | 'terraform'>('docker');

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <SectionBadge label="20% Weightage" color="text-violet-400 border-violet-500/30 bg-violet-500/10" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-300">
              CI/CD Pipeline
            </h2>
            <p className="text-slate-400 mt-2">GitHub Actions workflow + Docker & Terraform improvements.</p>
          </div>
          <div className="p-3 bg-violet-500/20 rounded-xl text-violet-400 border border-violet-500/30">
            <GitBranch className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Code block */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-xs font-mono text-slate-500">.github/workflows/deploy.yml</span>
          </div>
          <div className="flex items-center gap-2">
            <CopyButton text={YAML_CODE} />
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(YAML_CODE)}`}
              download="deploy.yml"
              title="Download deploy.yml"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all duration-200"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          </div>
        </div>
        <div className="p-6 overflow-x-auto bg-[#0d1117] max-h-96 overflow-y-auto">
          <pre className="text-sm font-mono text-slate-300 leading-relaxed whitespace-pre">{YAML_CODE}</pre>
        </div>
      </div>

      {/* Enhancements */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Architecture Improvements</h3>
        <div className="flex gap-2 mb-5">
          {[
            { key: 'docker', label: 'Docker', icon: <Shield className="w-4 h-4" /> },
            { key: 'terraform', label: 'Terraform (IaC)', icon: <CloudLightning className="w-4 h-4" /> },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveEnhancement(key as 'docker' | 'terraform')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                activeEnhancement === key
                  ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                  : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {activeEnhancement === 'docker' ? (
          <div className="space-y-4">
            <p className="text-slate-300 text-sm leading-relaxed">
              Containerise Django + Gunicorn, Celery worker, Nginx into Docker images pushed to AWS ECR.
              The EC2 deploy step becomes a single command — no more manual <code className="bg-slate-800 px-1 rounded text-blue-300 text-xs">pip install</code> drift.
            </p>
            <CommandBlock command="docker compose pull && docker compose up -d --remove-orphans" color="text-blue-300" />
            <ul className="space-y-2">
              <CheckItem>Identical environments from laptop to staging to prod</CheckItem>
              <CheckItem>Instant rollback — just run previous image tag</CheckItem>
              <CheckItem>Blue/green deployments become trivial with two compose stacks</CheckItem>
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-300 text-sm leading-relaxed">
              Define EC2, RDS, ElastiCache, S3, and CloudFront in <code className="bg-slate-800 px-1 rounded text-violet-300 text-xs">.tf</code> files.
              Store state in S3 with DynamoDB locking. Ephemeral QA environments become trivial.
            </p>
            <CommandBlock command="terraform workspace new qa-feature-x && terraform apply -auto-approve" color="text-violet-300" />
            <ul className="space-y-2">
              <CheckItem>Git-auditable infrastructure — every change reviewed in PRs</CheckItem>
              <CheckItem>Spin up identical QA environments per feature branch; tear down after merge</CheckItem>
              <CheckItem>Disaster recovery: rebuild entire stack in one command</CheckItem>
            </ul>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <Accordion title="Why not GitHub Actions environments/approvals?">
          Adding GitHub Environments with required reviewers adds a mandatory approval gate before production deployments. This is an easy win that should be added regardless of Docker/Terraform adoption.
        </Accordion>
        <Accordion title="Current pain points this solves">
          Semi-manual deployments break when pip dependencies conflict between staging and prod. S3 sync without CloudFront invalidation leaves stale cached assets. Terraform eliminates both by codifying the exact versions and cache rules.
        </Accordion>
      </div>
    </div>
  );
}

// ─── PART 4 ────────────────────────────────────────────────────────────────
const DEBUG_STEPS = [
  {
    num: 1,
    ring: 'border-rose-500',
    shadow: 'shadow-[0_0_20px_rgba(244,63,94,0.3)]',
    numColor: 'text-rose-400',
    accent: 'border-l-rose-500',
    codeColor: 'text-rose-300',
    title: 'Step 1 — Django API & Nginx logs (EC2)',
    eta: '< 2 min',
    why: 'The front door. A 403 on the S3 PUT immediately points to IAM key rotation (common after weekend maintenance). A 502 Bad Gateway means Gunicorn itself crashed.',
    commands: [
      'sudo tail -200 /var/log/nginx/error.log | grep -iE "error|403|500|502"',
      'sudo journalctl -u gunicorn -n 100 --no-pager',
    ],
    what: 'Look for 403 Forbidden (IAM), 502 Bad Gateway (Gunicorn down), or 413 Entity Too Large (file size limit).',
  },
  {
    num: 2,
    ring: 'border-orange-500',
    shadow: '',
    numColor: 'text-orange-400',
    accent: 'border-l-orange-500',
    codeColor: 'text-orange-300',
    title: 'Step 2 — Celery Worker Health (Flower)',
    eta: '< 3 min',
    why: 'If the API returns 200 (S3 upload OK) but validation never completes, the bug is async. Monday 9 AM surge can OOM-crash workers silently.',
    commands: [
      'curl http://localhost:5555/api/workers  # Flower REST API',
      'sudo systemctl status celery',
      'sudo journalctl -u celery -n 100 --no-pager',
    ],
    what: 'Queue depth high but active tasks = 0 → workers are dead. Restart and check memory. Tasks in FAILURE state → inspect traceback in Flower.',
  },
  {
    num: 3,
    ring: 'border-yellow-500',
    shadow: '',
    numColor: 'text-yellow-400',
    accent: 'border-l-yellow-500',
    codeColor: 'text-yellow-300',
    title: 'Step 3 — Bedrock Throttling & RDS Connections',
    eta: '< 5 min',
    why: 'Monday 9 AM is peak load. Bedrock has Tokens-Per-Minute quotas. PostgreSQL has a max_connections limit — Celery spinning up many workers can exhaust it.',
    commands: [
      '# CloudWatch > Bedrock > ThrottlingExceptions metric',
      '# RDS Console > Performance Insights > Top waits',
      "SELECT count(*), state FROM pg_stat_activity GROUP BY state;  -- run in RDS",
    ],
    what: 'ThrottlingException (429) → request Bedrock quota increase. DB connections near max → add pgBouncer connection pooler or reduce worker concurrency.',
  },
];

function Part4() {
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <SectionBadge label="20% Weightage" color="text-rose-400 border-rose-500/30 bg-rose-500/10" />
          <SectionBadge label="Monday 9 AM" color="text-orange-400 border-orange-500/30 bg-orange-500/10" />
        </div>
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-rose-400 to-orange-300">
          Debugging the Monday Outage
        </h2>
        <p className="text-slate-400 mt-2">POD photo uploads failing. Systematic root-cause analysis — in exact order.</p>
      </div>

      {/* Upload flow */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Upload Path</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {['Driver App', 'Django API (EC2)', 'S3 (image store)', 'Celery Task', 'Bedrock (POD validation)', 'PostgreSQL (result)'].map((s, i, arr) => (
            <>
              <span key={s} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg font-medium text-slate-300">{s}</span>
              {i < arr.length - 1 && <span key={`arrow-${i}`} className="text-slate-600">→</span>}
            </>
          ))}
        </div>
        <p className="text-slate-500 text-xs mt-3">Each step is a potential failure point. We debug in order — front to back.</p>
      </Card>

      {/* Debugging steps (interactive accordion) */}
      <div className="relative space-y-4 before:absolute before:left-5 before:top-0 before:bottom-0 before:w-0.5 before:bg-gradient-to-b before:from-rose-500/30 before:via-orange-500/20 before:to-yellow-500/10">
        {DEBUG_STEPS.map((step) => (
          <div key={step.num} className="relative pl-14">
            <button
              onClick={() => setExpandedStep(expandedStep === step.num ? null : step.num)}
              className={`absolute left-0 top-3 w-10 h-10 border-2 ${step.ring} bg-slate-950 rounded-full flex items-center justify-center font-bold ${step.numColor} z-10 ${step.shadow} hover:scale-110 transition-transform`}
            >
              {step.num}
            </button>
            <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden border-l-4 ${step.accent}`}>
              <button
                onClick={() => setExpandedStep(expandedStep === step.num ? null : step.num)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/30 transition-colors"
              >
                <div>
                  <h3 className="text-base font-semibold text-slate-200">{step.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">ETA to diagnosis: {step.eta}</p>
                </div>
                {expandedStep === step.num ? (
                  <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                )}
              </button>
              {expandedStep === step.num && (
                <div className="px-5 pb-5 space-y-4 border-t border-slate-800/60">
                  <div className="pt-4">
                    <p className="text-sm text-slate-300 leading-relaxed mb-4">{step.why}</p>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Commands / Dashboards</h4>
                    <div className="space-y-2">
                      {step.commands.map((cmd) => (
                        <CommandBlock key={cmd} command={cmd} color={step.codeColor} />
                      ))}
                    </div>
                    <div className="mt-4 bg-slate-950 rounded-xl p-4 border border-slate-800">
                      <p className="text-xs font-semibold text-slate-400 mb-1">What to look for:</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{step.what}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Accordion title="What if all 3 steps look healthy?">
          Check the Driver App itself — it may be sending a malformed Content-Type header or the image may exceed the Django FILE_UPLOAD_MAX_MEMORY_SIZE limit. Also check if a recent deploy changed the S3 bucket policy or CORS rules.
        </Accordion>
        <Accordion title="How do you prevent this in future?">
          Add Sentry (or AWS X-Ray) distributed tracing across all steps. Set CloudWatch alarms on Bedrock ThrottlingExceptions, Celery queue depth, and RDS connection utilisation. Proactive alerting stops this being a surprise on Monday.
        </Accordion>
      </div>
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 1, name: 'Gateway', desc: 'Pooling & Rate Limits', weight: '40%' },
  { id: 2, name: 'Mobile', desc: 'Cross-platform App', weight: '20%' },
  { id: 3, name: 'CI/CD', desc: 'Pipelines & IaC', weight: '20%' },
  { id: 4, name: 'Debugging', desc: 'Incident Resolution', weight: '20%' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState(1);

  const CONTENT: Record<number, React.ReactNode> = {
    1: <Part1 />,
    2: <Part2 />,
    3: <Part3 />,
    4: <Part4 />,
  };

  return (
    <div className="min-h-screen flex bg-[#030712] text-slate-200" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Sidebar (desktop) ── */}
      <aside className="w-72 border-r border-slate-800/60 bg-slate-950/70 backdrop-blur-3xl flex-col fixed inset-y-0 lg:flex hidden z-50">
        {/* Brand */}
        <div className="p-7 border-b border-slate-800/60">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.5)] mb-4">
            <div className="w-4 h-4 bg-white rounded-sm rotate-45" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Symplichain</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Software Engineering Intern — Hackathon</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'w-full flex items-start gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 border-l-2 text-left',
                activeTab === tab.id
                  ? 'bg-indigo-500/10 border-indigo-500'
                  : 'border-transparent hover:bg-slate-800/50 hover:border-slate-700',
              ].join(' ')}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${activeTab === tab.id ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {tab.id}
              </div>
              <div>
                <div className={`text-sm font-semibold ${activeTab === tab.id ? 'text-indigo-400' : 'text-slate-400'}`}>
                  Part {tab.id}: {tab.name}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">{tab.desc} · {tab.weight}</div>
              </div>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800/60 space-y-3">
          <button
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-sm font-semibold rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all"
          >
            <Download className="w-4 h-4" /> Export as PDF
          </button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-sm font-semibold rounded-xl transition-all border border-slate-700"
          >
            <ExternalLink className="w-4 h-4" /> View on GitHub
          </a>
          <p className="text-xs text-slate-600 text-center pt-1">Candidate Submission · 2026</p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 lg:pl-72 pb-24 lg:pb-0">
        {/* Top progress bar */}
        <div className="fixed top-0 left-0 lg:left-72 right-0 h-0.5 bg-slate-900 z-40">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${(activeTab / TABS.length) * 100}%` }}
          />
        </div>

        <main className="max-w-4xl mx-auto px-5 py-12 lg:px-12 lg:py-14">
          {CONTENT[activeTab]}

          {/* Prev / Next navigation */}
          <div className="flex items-center justify-between mt-12 pt-8 border-t border-slate-800/60">
            <button
              onClick={() => setActiveTab((p) => Math.max(1, p - 1))}
              disabled={activeTab === 1}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-sm font-medium hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ← Previous
            </button>
            <span className="text-xs text-slate-600">{activeTab} / {TABS.length}</span>
            <button
              onClick={() => setActiveTab((p) => Math.min(TABS.length, p + 1))}
              disabled={activeTab === TABS.length}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next →
            </button>
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl z-50">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex-1 flex flex-col items-center py-3 text-xs font-semibold transition-colors border-t-2',
                activeTab === tab.id
                  ? 'text-indigo-400 border-indigo-500'
                  : 'text-slate-600 border-transparent hover:text-slate-400',
              ].join(' ')}
            >
              <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs mb-1 ${activeTab === tab.id ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                {tab.id}
              </span>
              {tab.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
