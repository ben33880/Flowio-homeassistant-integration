// Demo contract fixture only, not Home Assistant's implementation or a visual reference.
// Never imported by src/ or included in the production bundle.
if(!window.loadCardHelpers){
  class DemoHeadingCard extends HTMLElement{
    constructor(){super();this._config={};this._hass=undefined;this.badges=new Map();this.attachShadow({mode:'open'}).innerHTML='<style>:host{display:block;min-width:0}.container{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.content{display:flex;align-items:center;gap:8px;min-width:0;color:var(--ha-heading-card-title-color,var(--primary-text-color));font-size:var(--ha-heading-card-title-font-size,20px);font-weight:var(--ha-heading-card-title-font-weight,400);line-height:var(--ha-heading-card-title-line-height,1.4);--mdc-icon-size:18px}.content ha-icon{display:flex;flex:none;color:inherit}h2{margin:0;font:inherit;min-width:0;overflow-wrap:anywhere}.badges{display:flex;align-items:center;gap:8px;min-width:0;max-width:55%}ha-heading-badge{display:inline-flex;min-width:0}button{display:flex;align-items:center;gap:4px;min-width:0;min-height:44px;border:0;background:transparent;color:var(--primary-text-color);font:12px system-ui;padding:0;cursor:pointer}button:focus-visible{outline:2px solid var(--primary-color)}.state{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.icon{flex-shrink:0;color:var(--primary-color)}[data-color=red] .icon{color:var(--error-color)}</style><div class=container><div class=content><ha-icon class=heading-icon></ha-icon><h2></h2></div><div class=badges></div></div>';}
    connectedCallback(){this.dataset.demoNative='true';this.sync();}
    setConfig(config){if(config.type!=='heading')throw new Error('Demo supports heading only');this._config=structuredClone(config);this.sync();}
    get hass(){return this._hass;}
    set hass(value){this._hass=value;this.sync();}
    sync(){
      this.shadowRoot.querySelector('h2').textContent=this._config.heading||'';this.shadowRoot.querySelector('.heading-icon').setAttribute('icon',this._config.icon||'');
      const row=this.shadowRoot.querySelector('.badges'),wanted=new Set();
      for(const config of this._config.badges||[]){
        wanted.add(config.entity);let badge=this.badges.get(config.entity);
        if(!badge){badge=document.createElement('ha-heading-badge');badge.dataset.entity=config.entity;const button=document.createElement('button'),icon=document.createElement('span'),state=document.createElement('span');icon.className='icon';icon.setAttribute('aria-hidden','true');state.className='state';button.append(icon,state);badge.append(button);button.addEventListener('click',()=>this.action(badge.config));this.badges.set(config.entity,badge);}
        badge.config=config;badge.dataset.color=config.color||'none';const state=this._hass?.states?.[config.entity]?.state;const shown=state===undefined||state==='unknown'||state==='unavailable'?'-':state;
        const content=config.state_content?Array.isArray(config.state_content)?config.state_content:[config.state_content]:['state'];
        badge.querySelector('.state').textContent=config.show_state?content.map(item=>item==='name'?config.name:item==='state'?shown:'').filter(Boolean).join(' · '):'';badge.querySelector('.icon').textContent=config.show_icon?(config.name==='Alertes'?'♧':'◇'):'';badge.querySelector('button').setAttribute('aria-label',`${config.name||config.entity} : ${shown}`);row.append(badge);
      }
      for(const[id,badge]of this.badges)if(!wanted.has(id)){badge.remove();this.badges.delete(id);}
    }
    action(config){const action=config.tap_action||{action:'none'};if(action.action==='more-info')this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:action.entity||config.entity},bubbles:true,composed:true}));else if(action.action==='fire-dom-event')this.dispatchEvent(new CustomEvent('ll-custom',{detail:action,bubbles:true,composed:true}));}
  }
  if(!customElements.get('hui-heading-card'))customElements.define('hui-heading-card',DemoHeadingCard);
  class DemoTileCard extends HTMLElement{
    constructor(){super();this._config={};this._hass=undefined;this.attachShadow({mode:'open'}).innerHTML='<style>:host{display:block}.tile{box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--divider-color);border-radius:14px;background:var(--card-background-color);cursor:pointer}.icon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:40px;height:40px;border-radius:50%;border:0;background:var(--secondary-background-color);color:var(--secondary-text-color);font-size:18px;cursor:pointer}.tile[data-on=true] .icon{background:color-mix(in srgb,var(--amber-color,#ffa000) 22%,transparent);color:var(--amber-color,#ffa000)}.copy{display:flex;flex-direction:column;gap:2px;min-width:0}.name{font-size:.92rem;font-weight:600}.state{font-size:.8rem;color:var(--secondary-text-color)}</style><div class=tile><button class=icon aria-label=toggle>⏻</button><div class=copy><span class=name></span><span class=state></span></div></div>';const root=this.shadowRoot;this.tileEl=root.querySelector('.tile');this.nameEl=root.querySelector('.name');this.stateEl=root.querySelector('.state');root.querySelector('.icon').addEventListener('click',e=>{e.stopPropagation();this._hass?.callService?.('switch','toggle',{entity_id:this._config.entity});});this.tileEl.addEventListener('click',()=>this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:this._config.entity},bubbles:true,composed:true})));}
    setConfig(config){if(config.type!=='tile')throw new Error('Demo supports tile only');this._config=config;this.sync();}
    set hass(value){this._hass=value;this.sync();}
    sync(){const s=this._hass?.states?.[this._config.entity],on=s?.state==='on';this.tileEl.dataset.on=on?'true':'false';this.nameEl.textContent=this._config.name||s?.attributes?.friendly_name||this._config.entity;this.stateEl.textContent=!s?'Indisponible':on?'Activé':s.state==='off'?'Désactivé':s.state;}
  }
  if(!customElements.get('hui-tile-card'))customElements.define('hui-tile-card',DemoTileCard);
  window.loadCardHelpers=async()=>({createCardElement(config){if(config.type==='heading'){const card=document.createElement('hui-heading-card');card.setConfig(config);return card;}if(config.type==='tile'){const card=document.createElement('hui-tile-card');card.setConfig(config);return card;}throw new Error(`Unsupported demo card: ${config.type}`);}});
}
