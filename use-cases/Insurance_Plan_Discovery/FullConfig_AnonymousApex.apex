// Recreate and fully configure ipd_greeting intent + 2 actions + 0 details
String ns = 'ccai_qa__';
String agentId = 'a0qQH000005Gw2HYAS';

// Create intent
SObject intent = (SObject) Type.forName(ns + 'AI_Agent_Intent__c').newInstance();
intent.put('Name', 'ipd_greeting');
intent.put(ns + 'AI_Agent__c', agentId);
intent.put(ns + 'Sequence__c', 1);
intent.put(ns + 'Description__c', 'Trigger when a user sends a greeting or opens the chat with no specific question — hi hello hey good morning good afternoon how are you or starts without a clear insurance query.');
intent.put(ns + 'Is_Active__c', true);
insert intent;
Id intentId = intent.Id;
System.debug('OK Created ipd_greeting: ' + intentId);

// Action 1 — Canned Response EN
SObject act1 = (SObject) Type.forName(ns + 'AI_Intent_Action__c').newInstance();
act1.put(ns + 'AI_Agent_Intent__c', intentId);
act1.put(ns + 'Sequence__c', 1);
act1.put(ns + 'Action_Type__c', 'Canned Response');
act1.put(ns + 'Language__c', 'en');
act1.put(ns + 'Canned_Response__c', 'Hello! Welcome to Insurance Plan Discovery. I\'m here to help you find the right health insurance plan. I can: show you all available plans, compare plans side by side, and recommend the best plan based on your age, family size, budget, and health history. What would you like to explore today?');
act1.put(ns + 'Is_Active__c', true);
insert act1;
System.debug('OK Action 1 (Canned EN): ' + act1.Id);

// Action 2 — Canned Response ES
SObject act2 = (SObject) Type.forName(ns + 'AI_Intent_Action__c').newInstance();
act2.put(ns + 'AI_Agent_Intent__c', intentId);
act2.put(ns + 'Sequence__c', 2);
act2.put(ns + 'Action_Type__c', 'Canned Response');
act2.put(ns + 'Language__c', 'es');
act2.put(ns + 'Canned_Response__c', '¡Hola! Bienvenido al asistente de Descubrimiento de Seguros de Salud. Puedo ayudarte a explorar nuestros planes, compararlos y recomendarte el más adecuado según tu perfil. ¿Por dónde quieres empezar?');
act2.put(ns + 'Is_Active__c', true);
insert act2;
System.debug('OK Action 2 (Canned ES): ' + act2.Id);

System.debug('ipd_greeting fully configured. No detail records needed (Canned Response only).');
