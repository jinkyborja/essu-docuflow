<script lang="ts">
 import { page } from '$app/stores';
 import { goto } from '$app/navigation';
 import { onMount, tick } from 'svelte';
 import RowMenu from '$lib/components/ui/RowMenu.svelte';
 import { showToast } from '$lib/stores/toasts';
 import { sidebarCollapsed, sidebarMobileOpen } from '$lib/stores/sidebar';
 type NavItem = {label: string; icon: string; href: string; adminOnly?: boolean; badge?: number; locked?: boolean; lockedReason?: string};
 const {items, role, userRole}: {items: NavItem[]; role: 'staff' | 'student'; userRole?: string} = $props();
 let narrow = $state(false), navigation = $state<HTMLElement>();
 const mobileOpen = $derived($sidebarMobileOpen);
 const collapsed = $derived($sidebarCollapsed && !narrow);
 const user = $derived($page.data.layoutUser);
 const logoLabel = $derived(role === 'student' ? 'Student Portal' : userRole === 'Admin' ? 'Admin Portal' : 'Staff Portal');
 const requestAction = $derived(items.find(item => item.href === '/student/request'));
 const links = $derived(items.filter(item => item.href !== '/student/request'));
 const menuItems = $derived([{label: 'My Profile', href: role === 'student' ? '/student/profile' : '/staff/profile', onselect: closeMobile}, {label: 'Log out', onselect: () => void logout()}]);
 function closeMobile() { sidebarMobileOpen.set(false); }
 function resize() { narrow = window.innerWidth < 1024; if (!narrow) closeMobile(); }
 onMount(resize);
 async function logout() { try { const response = await fetch('/api/logout', {method: 'POST'}); if (!response.ok) throw new Error('Could not log out. Please try again.'); await goto('/login'); } catch (error) { showToast(error instanceof Error ? error.message : 'Could not log out. Please try again.', 'error'); } }
 function isActive(href: string) { return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/'); }
 $effect(() => {
  if (!mobileOpen || !narrow) return;
  const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  void tick().then(() => navigation?.querySelector<HTMLElement>('a[aria-current="page"], button')?.focus());
  return () => { document.body.style.overflow = overflow; previous?.focus(); };
 });
 function keys(event: KeyboardEvent) {
  if (mobileOpen && event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); closeMobile(); }
  if (mobileOpen && event.key === 'Tab') {
   const controls = Array.from(navigation?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[role="menuitem"]') ?? []).filter(el => el.getClientRects().length && el.tabIndex >= 0);
   const first = controls[0], last = controls.at(-1);
   if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
   else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'b') { event.preventDefault(); sidebarCollapsed.update(value => !value); }
 }
</script>
<svelte:window onresize={resize} onkeydown={keys} />
{#if mobileOpen && narrow}<div class="sidebar-overlay" role="presentation" onclick={closeMobile}></div>{/if}
<aside bind:this={navigation} id="portal-navigation" class="portal-sidebar" class:collapsed class:open={mobileOpen} inert={narrow && !mobileOpen} aria-label="Sidebar navigation">
 <div class="sidebar-brand"><span class="brand-mark"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i></span>{#if !collapsed}<div><strong>ESSU</strong><p>{logoLabel}</p></div>{/if}<button class="drawer-close" type="button" onclick={closeMobile} aria-label="Close navigation" title="Close navigation"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>
 <nav aria-label="Main navigation">
  {#if requestAction}<div class="request-shortcut">{#if requestAction.locked}<button type="button" class="nav-item request-cta" aria-disabled="true" aria-label={'Request Document. ' + requestAction.lockedReason} title={requestAction.lockedReason}><i class="fa-solid fa-lock" aria-hidden="true"></i>{#if !collapsed}<span>Request Document</span>{/if}</button>{:else}<a href={requestAction.href} aria-label="Request Document" onclick={closeMobile} class="nav-item request-cta" title="Request Document"><i class={requestAction.icon} aria-hidden="true"></i>{#if !collapsed}<span>Request Document</span>{/if}</a>{/if}</div>{/if}
  {#each links as item}
   {#if item.href === '/staff/requests'}<p class="nav-section" class:sr-only={collapsed}>Work queue</p>{:else if item.href === '/staff/students'}<p class="nav-section" class:sr-only={collapsed}>Administration</p>{:else if item.href === '/staff/reports'}<p class="nav-section" class:sr-only={collapsed}>Workspace</p>{:else if item.href === '/student/documents'}<p class="nav-section" class:sr-only={collapsed}>Requests</p>{:else if item.href === '/student/notifications'}<p class="nav-section" class:sr-only={collapsed}>Account</p>{/if}
   {#if item.adminOnly && userRole !== 'Admin'}<button type="button" class="nav-item restricted" aria-disabled="true" aria-label={item.label + '. Admin only'} title="Admin only"><i class="fa-solid fa-lock" aria-hidden="true"></i>{#if !collapsed}<span>{item.label}</span>{/if}</button>{:else}<a href={item.href} onclick={closeMobile} class="nav-item" aria-label={item.badge ? item.label + ', ' + item.badge + ' unread' : item.label} aria-current={isActive(item.href) ? 'page' : undefined} title={item.label}><i class={item.icon} aria-hidden="true"></i>{#if !collapsed}<span>{item.label}</span>{/if}{#if (item.badge ?? 0) > 0}<span class="nav-count" aria-hidden="true">{item.badge! > 99 ? '99+' : item.badge}</span>{/if}</a>{/if}
  {/each}
 </nav>
 <div class="sidebar-footer"><RowMenu items={menuItems} label="User menu" triggerClass="sidebar-user-trigger">
  {#snippet triggerContent()}<span class="user-avatar">{user?.initials ?? '?'}</span>{#if !collapsed}<span class="sidebar-user-copy"><strong>{user?.name ?? 'User'}</strong><span>{role === 'student' ? 'Student' : userRole ?? 'Staff'}</span></span>{/if}{/snippet}
  {#snippet header()}<strong>{user?.name}</strong>{#if role === 'student' && user?.program}<p>{user.program}</p>{/if}{/snippet}
 </RowMenu><button type="button" class="sidebar-logout" onclick={() => void logout()} aria-label="Log out" title="Log out"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i></button></div>
</aside>
<style>
 .portal-sidebar { position: fixed; inset: 0 auto 0 0; z-index: 40; display: flex; flex-direction: column; width: 248px; background: var(--color-sidebar); color: var(--color-surface); transition: width var(--motion-fast), transform var(--motion-fast); }
 .portal-sidebar.collapsed { width: 72px; }
 .sidebar-brand { min-height: 64px; display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border-bottom: 1px solid color-mix(in srgb,var(--color-surface) 16%,transparent); }
 .brand-mark { width: 40px; height: 40px; flex-shrink: 0; display: grid; place-items: center; border-radius: var(--radius-control); background: color-mix(in srgb,var(--color-accent) 16%,transparent); color: var(--color-accent); font-size: 20px; }
 .sidebar-brand strong { font-size: var(--type-body); font-weight: var(--weight-semibold); } .sidebar-brand p { font-size: var(--type-helper); color: var(--color-accent); }
 nav { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: var(--space-4) var(--space-3); }
 .nav-section { margin: var(--space-6) 0 var(--space-2); padding-inline: var(--space-3); color: color-mix(in srgb,var(--color-surface) 75%,var(--color-sidebar)); font-size: var(--type-helper); font-weight: var(--weight-medium); text-transform: uppercase; letter-spacing: .06em; }
 .nav-item { position: relative; width: 100%; min-height: 40px; display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); margin-bottom: var(--space-1); border-radius: var(--radius-control); font-size: var(--type-body); font-weight: var(--weight-medium); text-align: left; color: var(--color-surface); }
 .nav-item > i { width: 20px; font-size: 20px; flex-shrink: 0; text-align: center; } .nav-item > span:not(.nav-count) { flex: 1; }
 .nav-item:hover { background: color-mix(in srgb,var(--color-surface) 6%,transparent); } .nav-item[aria-current='page'] { background: color-mix(in srgb,var(--color-surface) 12%,transparent); font-weight: var(--weight-semibold); }
 .nav-item[aria-current='page']::before { position: absolute; content: ''; inset: 8px auto 8px 0; width: 3px; border-radius: var(--radius-control); background: var(--color-accent); }
 .request-shortcut { margin-bottom: var(--space-4); } .request-cta { color: var(--color-sidebar); background: var(--color-accent); font-weight: var(--weight-semibold); } .request-cta:hover { background: color-mix(in srgb,var(--color-accent) 85%,var(--color-surface)); }
 .restricted { cursor: not-allowed; color: color-mix(in srgb,var(--color-surface) 75%,var(--color-sidebar)); } .nav-count { min-width: 24px; padding-inline: var(--space-1); border-radius: var(--radius-pill); background: var(--color-surface); color: var(--color-primary-dark); font-size: var(--type-helper); font-weight: var(--weight-semibold); text-align: center; }
 .collapsed .nav-item { justify-content: center; padding-inline: var(--space-2); } .collapsed .nav-count { position: absolute; right: 0; top: 0; min-width: 20px; }
 .sidebar-footer { display: flex; align-items: center; gap: var(--space-1); padding: var(--space-3); border-top: 1px solid color-mix(in srgb,var(--color-surface) 16%,transparent); }
 .sidebar-footer :global(.sidebar-user-trigger) { min-height: 56px; height: auto; border: 0; background: transparent; color: var(--color-surface); padding: var(--space-1); }
 .sidebar-footer :global(.sidebar-user-trigger:hover) { background: color-mix(in srgb,var(--color-surface) 6%,transparent); }
 .user-avatar { width: 32px; height: 32px; display: grid; place-items: center; flex-shrink: 0; border-radius: var(--radius-pill); background: var(--color-surface); color: var(--color-primary-dark); font-size: var(--type-helper); font-weight: var(--weight-semibold); }
 .sidebar-user-copy { display: flex; flex-direction: column; max-width: 136px; text-align: left; overflow-wrap: anywhere; } .sidebar-user-copy strong { font-size: var(--type-helper); font-weight: var(--weight-semibold); } .sidebar-user-copy > span { font-size: var(--type-helper); }
 .sidebar-logout,.drawer-close { width: 40px; height: 40px; display: grid; place-items: center; flex-shrink: 0; border-radius: var(--radius-control); } .sidebar-logout:hover,.drawer-close:hover { background: color-mix(in srgb,var(--color-surface) 6%,transparent); }
 .collapsed .sidebar-footer { flex-direction: column; } .drawer-close { display: none; margin-left: auto; }
 .sidebar-overlay { position: fixed; inset: 0; z-index: 30; background: var(--color-overlay); }
 @media(max-width:1023px) { .portal-sidebar { transform: translateX(-100%); } .portal-sidebar.open { transform: translateX(0); } .drawer-close { display: grid; } }
 @media(pointer:coarse) { .nav-item,.sidebar-logout,.drawer-close { min-height: 44px; } }
</style>
