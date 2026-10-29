% CANDIDATE STRICT PoC PROFILE: native current stake, 72h validity, no grace.
% Historical 72h grace policy is retained separately; this is not its port.
% No commitment, wallet-control claim, Telegram identifier or bot challenge.
:- consult('/v1/lib/staking.pl').
controller('__CONTROLLER__').

decide(C,V):-decide(C,V,_).
decide(C,V,M):-
 ground(C),'.'(C,'cw:tx',Tx),'.'(Tx,message,Msg),'.'(Msg,sender,Payer),
 '.'(C,intent,Intent),
 (Intent=qualify_wallet_v1->
   C=ctx{intent:qualify_wallet_v1,regime:telegram_publish_strict_v1,subject:Subject,
         'gov:module':_,'cw:tx':_},
   '.'(Msg,funds,[]),
   bech32_address(axone-Bytes,Subject),length(Bytes,20),
   bech32_address(axone-Bytes,Canonical),Subject=Canonical,
   '.'(Tx,block,Block),'.'(Block,time_seconds,Now),integer(Now),Now>=0,
   staking_bonded_delegated_balance(Subject,coin(uaxone,Amount)),
   assess_wallet(Amount,Now,Status,Until),
   V=wallet_entitlement_v1(telegram_publish_strict_v1,Subject,Status,Now,Until),
   M=native_subject_staking;
  controller(Payer),member(Intent,['gov:establish','gov:revise_constitution']),
  V='gov:permitted',M=governance_authorization).

% Exact comparison also accepts the native library's canonical decimal atoms.
assess_wallet(Amount,Now,Status,Until):-
 integer(Now),Now>=0,amount_digits(Amount,Codes),length(Codes,Length),
 (Length>10;Length=:=10,Codes @>= [49,48,48,48,48,48,48,48,48,48]),!,
 Status=eligible,Until is Now+259200.
assess_wallet(Amount,Now,read_only,Now):-
 integer(Now),Now>=0,amount_digits(Amount,Codes),length(Codes,Length),
 (Length<10;Length=:=10,Codes @< [49,48,48,48,48,48,48,48,48,48]).
amount_digits(Amount,Codes):-
 (integer(Amount)->Amount>=0,number_codes(Amount,Codes);atom(Amount),atom_codes(Amount,Codes)),
 Codes=[Head|_],(Codes=[48];Head>=49,Head=<57),digits(Codes).
digits([]).
digits([D|Ds]):-D>=48,D=<57,digits(Ds).
