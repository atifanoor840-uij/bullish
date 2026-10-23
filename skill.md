Purple Prop-Firm Account Dashboard — exact design spec

Recreates a premium prop-firm trader account dashboard (dark-first, purple accent, Inter font) with these screens:

App shell — top navbar + collapsible left sidebar (drawer on < xl)
Account header card (plan badge, Login ID, status chips, trading cycle, Login info button) + tab bar
Overview tab — balance card, Trading Objectives (4 cards with segmented bars), Account Status chart
Calendar tab — monthly P&L calendar
History tab — stat cards, date/filters, trades table + empty state
Platform tab — device tabs, step-by-step login guide, video, download links, web terminal
Login info right drawer (OTP verify → credentials)

Every value below was measured from the live reference. Follow it literally: same class names, sizes, radii, colours, spacing. Do not use any other firm's logo, name, or copy — use the user's brand name/logo (ask if unknown) and neutral copy.

0. Stack & setup
Next.js (App Router) + React + TypeScript + Tailwind CSS v4 (@import "tailwindcss"), lucide-react icons, recharts for the status chart, next-themes (class strategy, default dark).
Font: Inter via next/font/google → variable --font-inter; body font-family: var(--font-inter).
Routes: /accounts (list), /accounts/[id]/overview, /accounts/[id]/calendar, /accounts/[id]/history, /accounts/[id]/platform. Shared layout.tsx under /accounts/[id] renders breadcrumb + header card + tab bar; each tab is a page.
0.1 globals.css (paste exactly)
css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-inter: var(--font-inter);
  --border-width-primary: .5px;
  --border-width-secondary: 1px;
  --radius: .5rem;

  /* palette (hex measured) */
  --color-white:#ffffff; --color-black:#000000;
  --color-purple-25:#f5f5ff; --color-purple-50:#f3f2ff; --color-purple-100:#efedfb; --color-purple-200:#e0defc;
  --color-purple-300:#d3d1fe; --color-purple-400:#a09bff; --color-purple-500:#635bff; --color-purple-600:#6760e3;
  --color-purple-700:#524bd0; --color-purple-800:#443fa5; --color-purple-900:#232063; --color-purple-1000:#161442; --color-purple-1050:#333151;
  --color-gray-25:#f8fafc; --color-gray-50:#eef2f6; --color-gray-100:#e3e8ef; --color-gray-200:#cdd5df; --color-gray-300:#9aa4b2;
  --color-gray-400:#788496; --color-gray-500:#4b5565; --color-gray-600:#364152; --color-gray-700:#202939; --color-gray-800:#181b26; --color-gray-950:#10121b;
  --color-red-50:#fff3f5; --color-red-100:#ffeef1; --color-red-200:#ffced7; --color-red-300:#ff90a4; --color-red-400:#ff3440; --color-red-500:#ff3844;
  --color-red-600:#f91844; --color-red-700:#df1c41; --color-red-800:#c62c2c; --color-red-900:#96190c; --color-red-1050:#361c19;
  --color-yellow-50:#fef4e6; --color-yellow-100:#fdddb3; --color-yellow-300:#fab55a; --color-yellow-500:#f7900a; --color-yellow-700:#af6607; --color-yellow-950:#251601;
  --color-green-light-50:#f1fceb; --color-green-light-100:#e6fcd8; --color-green-light-400:#67cb29; --color-green-light-500:#49ad0a; --color-green-light-600:#378d00; --color-green-light-700:#088c16;
  --color-green-dark-25:#ecfdf6; --color-green-dark-100:#6ae7b5; --color-green-dark-200:#0fb674; --color-green-dark-300:#019b5d; --color-green-dark-500:#027a4a; --color-green-dark-700:#083027; --color-green-dark-800:#00170e;
  --color-blue-50:#eaf4ff; --color-blue-400:#58a6fb; --color-blue-500:#2e90fa; --color-blue-700:#2166b2;

  /* px font sizes used as text-10 … text-24 */
  --text-10:10px; --text-11:11px; --text-12:12px; --text-13:13px; --text-14:14px; --text-16:16px; --text-18:18px; --text-20:20px; --text-24:24px;
  /* px line-heights used as leading-12 … leading-29 */
  --leading-12:12px; --leading-14:14px; --leading-15:15px; --leading-16:16px; --leading-20:20px; --leading-22:22px; --leading-24:24px; --leading-28:28px; --leading-29:29px;
}

:root {
  --primary: var(--color-purple-500);
  --foreground: var(--color-gray-950);
  --border: var(--color-gray-100);
  --sidebar-foreground: var(--color-gray-600);
  --sidebar-foreground-hover: var(--color-gray-950);
  --sidebar-foreground-active: var(--color-purple-500);
  --sidebar-background-hover: oklch(from var(--color-purple-500) l c h / .06);
  --sidebar-background-active: var(--color-purple-50);
  --input-background: var(--color-gray-25); --input-foreground: var(--color-gray-950);
  --input-border: var(--color-gray-100); --input-outline: var(--color-purple-500);
  --input-placeholder: var(--color-gray-400); --input-invalid: var(--color-red-300);
  --body-background: linear-gradient(154deg, #f5f5ff 1.19%, #f8fafc 60.62%);
}
.dark {
  --primary: var(--color-purple-400);
  --foreground: #ffffff;
  --border: rgb(255 255 255 / .10);
  --sidebar-foreground: var(--color-gray-300);
  --sidebar-foreground-hover: var(--color-gray-200);
  --sidebar-foreground-active: var(--color-purple-400);
  --sidebar-background-hover: var(--color-purple-1050);
  --sidebar-background-active: var(--color-purple-1050);
  --input-background: rgb(255 255 255 / .02); --input-foreground:#fff;
  --input-border: rgb(255 255 255 / .10); --input-outline: var(--color-purple-400);
  --input-placeholder: var(--color-gray-300); --input-invalid: var(--color-red-400);
  --body-background: linear-gradient(154deg, #25253b 1.19%, #151825 60.62%);
}
@theme inline {
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-border: var(--border);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-foreground-hover: var(--sidebar-foreground-hover);
  --color-sidebar-foreground-active: var(--sidebar-foreground-active);
  --color-sidebar-background-hover: var(--sidebar-background-hover);
  --color-sidebar-background-active: var(--sidebar-background-active);
  --color-input-background: var(--input-background); --color-input-foreground: var(--input-foreground);
  --color-input-border: var(--input-border); --color-input-outline: var(--input-outline);
  --color-input-placeholder: var(--input-placeholder); --color-input-invalid: var(--input-invalid);
}
body { font-family: var(--font-inter), system-ui, sans-serif; }
.scrollbar-hide { scrollbar-width: none } .scrollbar-hide::-webkit-scrollbar { display: none }
0.2 Core tokens cheat-sheet
Role	Light	Dark
Page bg (behind content)	--body-background gradient	linear-gradient(154deg,#25253b,#151825)
Content panel	bg-white/75	bg-gray-950 (
#10121b)
Card	bg-white border-gray-100	bg-gray-800 border-white/10 (
#181b26)
Card shadow	shadow-[0_2px_10px_0_rgba(0,0,0,0.08)]	shadow-[0_2px_10px_0_rgba(0,0,0,0.3)]
Primary text	text-gray-950	text-white
Label text	text-gray-400 / text-[#788496]	text-gray-400 / text-gray-300
Accent	purple-500 
#635bff	purple-400 
#a09bff
Profit	text-green-light-700	text-green-dark-300
Loss	text-red-500	text-red-400
Card radius	rounded-2xl (16px); inner tiles rounded-xl; chips rounded-md / rounded-[4px]	

Type scale: section title text-16 leading-20 font-semibold; header ID text-18 leading-22 font-semibold; labels text-13 leading-20 font-medium; values text-16–text-20 font-semibold; big balance text-24 leading-29 font-medium; chips text-12 leading-14 font-medium.

1. Button variants (used everywhere)

Base: inline-flex items-center justify-center gap-1 whitespace-nowrap transition-all cursor-pointer font-inter [&_svg]:size-5 disabled:cursor-not-allowed

primary bg-purple-500 text-white hover:bg-purple-700 focus:bg-purple-800 dark:focus:bg-purple-600
outline-accent border border-gray-100 dark:border-white/10 text-purple-500 dark:text-purple-400 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700
secondary border bg-gray-25 dark:bg-gray-700 border-gray-100 dark:border-white/10 text-gray-950 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600
ghost-icon text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 h-9 w-9 p-2 rounded-lg border-0
Sizes: sm = h-[30px] px-4 py-[5px] rounded-md text-14 leading-20 font-medium; xs = h-[26px] px-3 py-[5px] rounded-md text-12 leading-16 font-semibold; md = h-9 px-5 py-2 rounded-lg text-14.
Filter chip (History/Platform): min-h-7 px-2.5 py-1.5 rounded-[4px] text-12 leading-[14px] font-medium border border-gray-100 dark:border-white/10 text-gray-950 dark:text-white hover:bg-purple-200 hover:text-purple-500 dark:hover:bg-purple-1050 dark:hover:text-purple-400 [&_svg]:size-3.5
2. App shell
<div class="min-h-screen" style="background:var(--body-background)">
  <div class="flex h-svh w-full overflow-hidden" style="--sidebar-width:15rem;--navbar-height:3.875rem">
    <Navbar/>  <Sidebar/>  <main class="relative flex w-full flex-1 flex-col min-w-0 pt-(--navbar-height)">
      <div class="h-full overflow-x-hidden overflow-y-auto rounded-t-4xl lg:mr-6">
        <div class="min-h-[calc(100vh-var(--navbar-height))] bg-white/75 dark:bg-gray-950">
          <div class="pb-8 max-w-360 mx-auto">
            <div class="flex flex-col gap-6 px-4 pb-6 lg:px-10 xl:py-0"> …page… </div>
2.1 Navbar (fixed, h 62px)

nav.fixed top-0 inset-x-0 h-(--navbar-height) flex items-center z-30 [background:var(--body-background)] border-b border-b-black/5 dark:border-b-white/5 xl:border-b-0 xl:[background:transparent] → inner flex items-center justify-between flex-1 px-2 xl:px-6.

Left: hamburger (xl:hidden, [&_svg]:size-6) + brand logo (icon < xl, wordmark ≥ xl, dark:text-white).
Center (hidden md:flex gap-2): AI assistant pill h-[30px] px-2 rounded-md bg-purple-50 dark:bg-purple-1050 text-14 leading-20 font-medium (icon + "Ask <Assistant>") and primary sm button "Start Challenge".
Right (flex gap-1 md:gap-2 mr-3): bell ghost-icon with badge absolute -top-1.5 right-[2px] min-w-4.5 h-4.5 px-1 rounded-full bg-red-400 text-white text-11 font-semibold; theme toggle (sun/moon); avatar menu pill min-w-10 min-h-7 p-0.75 rounded-[20px] bg-white/20 dark:bg-white/10 hover:bg-purple-200 dark:hover:bg-purple-1050 containing avatar size-5.5 rounded-full bg-purple-500 dark:bg-white text-white dark:text-purple-500 text-12 font-semibold + chevron.
Floating chat launcher bottom-right: fixed bottom-6 right-6 size-12 rounded-full bg-purple-500 with brand icon + red dot.
2.2 Sidebar (w 15rem ≥ xl, drawer w-72 < xl)

Container bg-white dark:bg-gray-800. Header (h 62px, px-3.5 py-3.5): avatar square size-10 rounded-[10px] bg-purple-50 dark:bg-white with initial text-[17px] font-semibold text-purple-500; name text-14 leading-20 font-medium text-foreground truncate + verified icon; email text-12 text-gray-400 truncate; close button (drawer only).

Below header: full-width outline chip "Free Trial" (rounded-md border border-border px-2.5 py-2.75 text-12 font-medium).
Section label MENUBAR text-11 leading-20 font-medium text-gray-400 pl-4 py-2.5 + collapse toggle (≥ xl).
Menu ul.flex flex-col gap-1.5 px-3.5; item: flex h-8 w-full items-center gap-2 rounded-md p-2 text-13 leading-20 font-medium text-sidebar-foreground hover:bg-sidebar-background-hover hover:text-sidebar-foreground-hover [&_svg]:size-[18px]; active: bg-sidebar-background-active font-semibold text-sidebar-foreground-active.
Items: Accounts, Payout, Refer & Earn, Become a partner, My Offers, Competitions, Certificates, (gap mt-6) Transactions, Help & Support ▾ (collapsible, chevron rotates 180°), More ▾. Bottom group mt-6: Log out.
Collapsed (icon mode): width 4rem, items size-9, labels hidden.
3. Account layout (shared by all tabs)
3.1 Breadcrumb

nav.hidden md:flex items-center gap-1.5 mb-4 pt-4: home icon size-4 text-gray-300 › Accounts (text-14 leading-16 font-medium text-[#A4A7AE] hover:text-gray-950 dark:hover:text-white) › current text-14 font-medium text-[#414651] dark:text-gray-300. Separators ChevronRight size-4 text-[#d5d7da]. Mobile shows ← Back (text-18 leading-22 font-semibold).

3.2 Header card
<div class="overflow-hidden rounded-2xl">
  <div class="flex flex-col px-4 py-2 md:p-6 rounded-t-2xl border-2 border-transparent shadow-[0px_1px_2px_0px_rgba(0,0,0,0.3)]
              bg-[linear-gradient(-90deg,#FFFFFF_25%,#EFEDFB_100%)] dark:bg-[linear-gradient(-90deg,#181b26_25%,#281f33_100%)]">
    <div class="flex flex-wrap items-end justify-between gap-5">
      LEFT: <PlanBadge/> + info column     RIGHT (hidden md:flex flex-col items-end justify-between gap-5 self-stretch): [Login info] / cycle text
  </div>
  <TabBar/>  (attached below, rounded-b-2xl)
</div>

PlanBadge (w-[125px] md:w-[140px] min-h-[90px] rounded-[6px] overflow-hidden border border-[#7230a5] bg-linear-to-b from-[#F7ECFF] to-[#F2E4FB] dark:from-[#3E1468] dark:to-[#441A6D] [box-shadow:0_15px_20px_0_rgba(103,39,172,0.20)] dark:[box-shadow:0_15px_20px_0_rgba(0,0,0,0.30)]):

top p-3 pb-2: type text-12 font-medium ("Free Trial" / "Phase 1" / "Funded") + size text-20 font-semibold tracking-[-0.8px] ("$6K"); colour text-[#7230A5] dark:text-[#C9A6EC].
divider h-px bg-[#7230A5]/20 dark:bg-white/10
footer h-6 px-3 bg-[#F2E4FB] dark:bg-[#3E1468] label text-11 font-semibold tracking-[0.66px] uppercase ("CHALLENGE").
Variants: green (
#027a4a/
#0fb674) for Funded, blue (
#2166b2/
#58a6fb) for Phase 2 — same structure.

Info column (flex flex-col gap-5): h2 text-18 leading-22 font-semibold "Login ID : 35255116" (mobile text-16 "ID : …"); chips row flex flex-wrap items-center gap-1 md:gap-3:

Status chip h-5 px-1 rounded-md text-12 leading-14 font-medium → Active bg-green-light-500 text-white dark:bg-green-dark-300 dark:text-gray-950; Breached bg-red-500 text-white; Passed bg-purple-500 text-white.
Meta chips (no bg) text-gray-400 dark:text-gray-300 with size-3 icon: platform ("MT5", BarChart icon), account type ("Swap", ArrowLeftRight icon).
Right side: Login info = outline-accent sm button with Lock icon size-4, px-3.5; under it Clock size-4 + text-12 leading-15 font-medium text-gray-400 "Trading Cycle: Oct 22, 2026 to Nov 4, 2026". Mobile: cycle as text-10 under chips.
3.3 Tab bar

div.rounded-b-2xl border-gray-100 bg-white px-6 pt-1.5 dark:border-white/10 dark:bg-gray-800 → horizontally scrollable flex w-max gap-5 md:gap-3. Each tab <Link class="shrink-0 border-b-2 pt-0.5 pb-1.5 whitespace-nowrap"> with span text-14 leading-16 font-semibold block rounded-md px-1.5 py-1.

active: link border-purple-500 dark:border-purple-400, span text-purple-500 dark:text-purple-400
idle: link border-transparent, span text-gray-400 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white Tabs: Overview · Calendar · History · Platform. Tab content wrapper: mt-4 xl:mt-6.
4. Overview tab

Layout: flex flex-col gap-4 lg:flex-row lg:gap-6 → right column order-1 lg:order-2 lg:w-90 shrink-0 (balance card) and left column order-2 lg:order-1 flex-1 flex flex-col gap-4 lg:gap-6 (objectives + status chart).

4.1 Balance card

Card rounded-2xl p-4 border (+card bg/shadow). Hero tile flex flex-col items-center gap-2 rounded-xl p-5 bg-purple-500/10: label "Current balance" text-14 leading-16 font-medium text-gray-600 dark:text-gray-300; value text-24 leading-29 font-medium "$6,000.00"; toggle text-13 font-medium text-purple-500 dark:text-purple-400 "Hide details ⌃" (ChevronUp size-3.5). Collapsible (grid transition-all duration-300 grid-rows-[1fr] ↔ grid-rows-[0fr] opacity-0) list pt-2, rows flex justify-between border-b border-gray-100 dark:border-white/10 py-3 last:border-0 last:pb-0: label text-13 leading-5 font-medium text-gray-400, value text-13 font-semibold text-gray-950 dark:text-white. Rows: Initial balance, Equity, Profit/Loss (green/red), Floating Profit/Loss (green/red).

4.2 Trading Objectives

Header row flex items-center justify-between gap-2: text-13 leading-20 font-medium text-gray-400 "Trading Objectives • Refresh in" + countdown chip min-h-5 text-12 leading-14 py-[3px] px-1.5 rounded-md bg-purple-50 dark:bg-purple-500/20 text-purple-500 dark:text-purple-400 ("4 Min : 48 Sec", clock icon) + secondary xs button "↻ Refresh" (auto-refresh every 5 min).

Grid: ≥ xl one card rounded-xl border border-[#E3E8EF] dark:border-white/10 bg-white dark:bg-gray-800 with grid grid-cols-4 *:min-h-62.5, cells separated by xl:border-l. < xl each cell is its own card (rounded-xl border p-4, row layout: info 52% + bar). Each cell flex flex-col gap-4 p-4:

label text-13 leading-20 font-medium text-[#788496] dark:text-gray-400 + Info tooltip icon size-3.5.
value text-16 leading-20 font-semibold text-foreground (e.g. "$300", "3 Days").
bottom xl:mt-auto flex flex-col gap-4: indicator, then Result: / Remaining: line text-13 leading-20 font-medium text-gray-700 dark:text-gray-200.

Cells: Profit target ($ and %), Min trading days (N days), Daily loss limit (-5%), Max loss limit (-10%).

Segmented bar (SVG) — <svg class="h-8 w-full" viewBox="0 0 400 32" preserveAspectRatio="none"> with 40 rects: x = i*10.1, y=8 width=6.1 height=24 rx=1.

Profit target: filled segments (round(pct*40)) fill-green-light-500 dark:fill-green-dark-300, rest fill-gray-200 dark:fill-gray-600. Above it a floating pill at left: pct% (absolute top-0 rounded-full border px-2 py-0.5 text-12 text-green-light-700 dark:text-green-dark-300 bg-green-light-700/10 dark:bg-green-dark-300/10 border-green-light-700/20) showing "0 %". Under bar: "0%" … "100%" text-12 text-[#788496] dark:text-gray-500.
Loss limits: first 32 segments (0–80%) base fill-gray-200 dark:fill-gray-600, last 8 (80–100% danger zone) fill-gray-100 dark:fill-gray-700; consumed loss segments fill-red-400 (use fill-yellow-500 while < 50%). Scale labels sit in a width:80% row. Extra info button at end of Remaining row: ml-auto size-5 rounded-[4px] bg-purple-500/30.
Min trading days: one pill per required day flex gap-1 → h-5 flex-1 rounded-full border-[.5px] border-gray-200 bg-gray-100 dark:border-gray-500 dark:bg-[#202939]; completed day bg-green-light-500 dark:bg-green-dark-300 border-transparent with ✓.
4.3 Account Status chart

Card rounded-2xl p-5 border + shadow. Header mb-6 flex justify-between: title text-16 leading-20 font-semibold "Account Status" + subtitle text-14 text-[#788496]; range dropdown rounded-[4px] px-3 py-1.5 text-13 font-medium border border-gray-200 bg-white text-gray-600 dark:border-[#333151] dark:bg-[#333151] dark:text-purple-400 ("7 Days" ▾ — options 7 Days / 30 Days / All). Body relative h-75: recharts AreaChart — balance line stroke #635bff (dark 
#a09bff) width 2, gradient fill 20%→0%; equity dashed 
#788496; dashed reference lines for max-loss level (
#ff3844) and profit target (
#49ad0a); grid rgba(255,255,255,.06) dark / 
#eef2f6 light; axis ticks 12px #788496, no axis lines. Empty: centered text-14 text-gray-400 dark:text-gray-500 "No data available".

5. Calendar tab

Header flex justify-between: h2 text-16 leading-20 font-semibold text-foreground "Trading Calendar"; month switcher flex items-center gap-1.5 rounded-md border border-[#E3E8EF] dark:border-white/10 px-2.5 py-1.5 → ‹ size-3.5 · text-12 leading-14 font-medium "October 2026" · ›.

Calendar card rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-800 pt-2 shadow-lg:

Weekday header grid grid-cols-5 sm:grid-cols-7 px-1, cells p-1 text-center text-14 leading-20 font-medium full names (Monday…Sunday) on sm+, single letter on mobile. Week starts Monday; Sat/Sun hidden on mobile (hidden sm:flex).
Days grid grid-cols-5 sm:grid-cols-7 gap-px md:gap-2 p-2; each day a button h-[120px] sm:h-[150px] w-full flex flex-col md:rounded-b-[6px] border-t border-gray-100 dark:border-white/10 text-left, inner flex h-full flex-col justify-between py-3 px-1.5 md:pl-2 md:pr-3, top row: day number h-7 w-7 flex items-center justify-center rounded-md text-[16px] leading-20 font-medium (2-digit, "01").

Day states:

State	Cell bg	Number
Out of month	bg-gray-50 dark:bg-gray-950	text-gray-300
Weekday (no trades)	bg-gray-25 dark:bg-white/[0.04]	text-gray-950 dark:text-white
Weekend	bg-gray-50 dark:bg-black/20 + right label text-12 font-medium text-gray-400 dark:text-gray-300 "Weekend"	normal
Today	normal bg	number bg-white dark:bg-white/20 rounded-md
Profit day	bg-green-light-50 dark:bg-green-dark-300/10 border-t-green-light-500 dark:border-t-green-dark-300	bottom: P&L text-16 font-semibold text-green-light-700 dark:text-green-dark-300 "+$245.10" + text-12 text-gray-400 "3 trades"
Loss day	bg-red-50 dark:bg-red-500/10 border-t-red-500	P&L text-red-500 dark:text-red-400

Click a day → right drawer (same sheet as §8) listing that day's trades.

6. History tab

Header flex flex-col md:flex-row justify-between gap-3 pt-3: h2 text-[16px] leading-[20px] font-semibold "Trading History" + cycle link text-14 text-gray-400 "Trading Cycle: 22 Oct to 4 Nov ⓘ"; right: date-range filter chip (Calendar icon, "Start date - End date") + "Filters" chip (w-28, SlidersHorizontal icon) → popover with Symbol, Type (Buy/Sell), Result (Win/Loss).

Stat cards grid sm:grid-cols-3 lg:grid-cols-5 gap-3 (mobile: horizontal scroll, w-[160px]). Card h-[120px] flex flex-col rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-800 p-5 shadow-[0_2px_10px_0_rgba(0,0,0,0.10)]: label text-[13px] leading-[20px] font-medium text-gray-400 + info dot size-[13px] rounded-full bg-gray-400 text-[9px] font-bold text-white "i"; value text-[20px] leading-[24px] font-semibold. Cards: Balance · Profit Factor · Win Rate · Avg Profit / Avg Loss · Total Trades.

Trades table card (rounded-2xl border bg-white dark:bg-gray-800 shadow-lg overflow-hidden):

thead bg-gray-25 dark:bg-white/[0.03] th px-4 py-3 text-12 leading-14 font-medium text-gray-400 text-left whitespace-nowrap.
Columns: Ticket · Symbol · Type · Lots · Open Time · Open Price · Close Time · Close Price · SL · TP · Commission · Swap · Profit.
td px-4 py-3.5 text-13 leading-20 font-medium text-gray-950 dark:text-white border-t border-gray-100 dark:border-white/10; Type chip h-5 px-1.5 rounded-md text-12 Buy bg-green-light-500/10 text-green-light-700 dark:text-green-dark-300, Sell bg-red-500/10 text-red-500; Profit coloured green/red.
Footer pagination flex justify-between px-4 py-3 text-13 text-gray-400 with prev/next filter-chip buttons. Mobile: rows become stacked cards.
Empty state: card flex flex-col items-center gap-3 rounded-2xl border px-6 py-12 sm:p-15 shadow-lg + illustration + text-12 leading-20 text-gray-400 dark:text-gray-300 max-w-[450px] text-center "No trades yet. Place your first trade to get started."
7. Platform tab

Device switch inline-flex gap-1.5 buttons rounded-[4px] px-2.5 py-1.5 text-12 leading-14 font-medium gap-1.5 [svg]:size-4:

active border border-purple-500/30 bg-white/[0.02] text-gray-950 shadow-[inset_0_0_30px_0_rgba(197,205,255,0.9)] dark:border-purple-500/60 dark:shadow-[inset_0_0_30px_0_rgba(99,91,255,0.4)] dark:text-white
idle border border-gray-100 text-gray-400 dark:border-white/10 dark:bg-gray-800 dark:text-gray-300 hover:text-gray-950
Tabs: Tablet · Desktop · Phone (content changes per device).

Layout flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6:

Guide card (left, flex-1, rounded-[10px] p-6 md:flex-row gap-6 bg-white dark:bg-[#181B26] shadow-[0_2px_10px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_10px_0_rgba(0,0,0,0.30)]):
Steps column flex flex-col gap-7: h2 text-16 font-semibold "Step-by-Step Login Guide"; steps flex gap-3 → number circle size-7 rounded-full border border-gray-100 bg-white dark:border-white/10 dark:bg-gray-800 text-12 font-bold; title text-12 leading-15 font-bold tracking-wide; body text-12 leading-5 text-gray-600 dark:text-gray-300. 5 steps: Download platform → Open & navigate → Add your account → Select the correct server → Verify & start trading.
Side column md:w-[260px] flex flex-col gap-5: video tile rounded-xl bg-purple-500/10 p-2.5 with thumbnail rounded-2xl + centered play button size-14 rounded-full bg-purple-500 shadow-lg + caption "Watch Video Tutorial"; download block title text-12 font-semibold text-gray-700 dark:text-gray-200 + buttons w-full rounded-md px-4 py-3 text-14 font-medium bg-purple-50 text-purple-500 dark:bg-[rgba(99,91,255,0.12)] dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-[rgba(99,91,255,0.20)] ("Download for Windows", "Download for MacOS" / App Store, Google Play on Phone/Tablet).
Get-started card (right, lg:w-[420px], same card style, overflow-hidden): h2 text-16 font-semibold, p text-14 text-gray-600 dark:text-gray-300, secondary sm button "Web Terminal"; mockup image box aspect-5/3 rounded-2xl bg-purple-500/10 translate-y-10 md:translate-x-8 md:translate-y-8 (bleeds off the card corner).
8. Login-info drawer (right sheet)

Sheet fixed inset-y-0 right-0 mx-4 my-auto h-full max-h-[calc(100%-40px)] w-[calc(100vw-32px)] sm:max-w-120 rounded-[10px] bg-white dark:bg-gray-800 flex flex-col gap-4, overlay bg-black/50 backdrop-blur-sm, enter animation drawer-in-right .5s cubic-bezier(0.32,0.72,0,1).

Header p-5 border-b border-gray-100 dark:border-white/10: text-18 leading-22 font-semibold "Verify your identity"; close button absolute top-2.75 right-2.75 p-2.5 rounded-md hover:bg-foreground/5.
Step 1 OTP: h3 text-24 leading-28 font-bold "Enter OTP", text-14 text-gray-400 "We've sent a 6-digit code to your email"; 6 inputs aspect-square max-w-11 md:max-w-12.5 rounded-lg border bg-input-background border-input-border text-18 md:text-20 font-medium text-center focus:border-input-outline; "Sent OTP again" underline text-13 text-gray-400 + countdown "( 03:01 )".
Step 2 credentials: rows (Login, Password ••• with eye + copy, Investor password, Server) as flex justify-between py-3 border-b, label text-13 text-gray-400, value text-13 font-semibold + copy icon button.
9. Accounts list page (/accounts)

Title text-16 font-semibold "Accounts" + filter chips (All / Active / Passed / Breached) + primary "Start Challenge". Grid grid md:grid-cols-2 xl:grid-cols-3 gap-4 of account cards using the header-card gradient: PlanBadge left, Login ID + status chip + balance text-20 font-semibold, mini segmented profit bar, footer link "View details →" text-purple-500.

10. Responsive rules
< md: breadcrumb → Back button; header actions collapse to a kebab; cycle text shown small under chips; Ask-assistant & Start Challenge move into sidebar / small primary.
< lg: Overview columns stack, balance card on top.
< xl: sidebar becomes left drawer (w-72, drawer-in-left), objective cells become separate stacked cards.
Calendar on mobile: 5 columns (Mon–Fri), height 120px.
Max content width max-w-360 (1440px); page padding px-4 lg:px-10.
11. Build checklist
Install deps, add globals.css exactly as §0.1, Inter font, next-themes defaultTheme dark.
Build primitives: Button, Card, Chip, SegmentedBar, DayPills, StatCard, Sheet, Tabs.
Build shell (§2), account layout (§3), then tabs §4–§7, drawer §8, list §9.
Use typed mock data (account, objectives, dailyPnl[], trades[], equitySeries[]) behind lib/api.ts so a backend can be plugged in later.
Verify both themes at 375px, 768px, 1280px, 1440px; compare against this spec value-by-value (radius, font size, colours).
Replace any placeholder brand name/logo with the user's own brand.