<script lang="ts">import type {Snippet} from 'svelte';let {children,helper=''}: {children?:Snippet;helper?:string}=$props();</script>
<div class="form-actions">{#if helper}<p class="field-helper">{helper}</p>{/if}<div>{#if children}{@render children()}{/if}</div></div>
<style>.form-actions {display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--color-border);flex-wrap:wrap;} .form-actions>div {display:flex;flex-wrap:wrap;justify-content:flex-end;gap:var(--space-2);margin-left:auto;}</style>
