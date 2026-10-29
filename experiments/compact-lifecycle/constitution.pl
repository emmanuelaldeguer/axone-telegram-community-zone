% LOCAL DIAGNOSTIC: symbolic c1/c2 commitments, single namespace/deployment.
% p(State,Action,ActiveStake,NativeTime,Event,NextState) is the pure core.
% s(Binding,Status,GraceStart,Expiry); none means unbound/absent.
% Availability failures abort execution, never extend previously granted rights.
p(S,X,A,T,F,N):-
 S=s(B,Q,G,E),
 (X=qualify(C)->
   (Q=revoked->F=refused,N=S;
    B\=none,B\=C->F=refused,N=S;
    A>=1000000000->N=s(C,eligible,none,D),D is T+259200,
      (B=none->F=admitted;F=renewed);
    B=none->F=refused,N=S;
    Q=eligible,T<E->F=grace,D is T+259200,N=s(B,grace_period,T,D);
    Q=grace_period,T<E->F=grace,N=s(B,Q,G,E);
    F=disqualified,N=s(B,read_only,none,none));
  X=revoke,B\=none->
   (Q=revoked->F=unchanged,N=S;F=revoked,N=s(B,revoked,none,none));
  X=revoke->F=refused,N=S;
  F=unchanged,N=S).

% These shape checks are for authenticated stored snapshots, never caller state.
v(s(none,read_only,none,none)).
v(s(B,Q,none,none)):-b(B),member(Q,[read_only,revoked]).
v(s(B,eligible,none,E)):-b(B),integer(E),E>0.
v(s(B,grace_period,G,E)):-b(B),integer(G),G>=0,integer(E),E>G.
b(B):-member(B,[c1,c2]).

:- consult('/v1/lib/staking.pl').
:- consult('/v1/lib/wasm.pl').
:- consult('/v1/lib/json.pl').
:- consult('/v1/lib/lists.pl').
gov('__GOV__').
admin('__CONTROLLER__').
decide(C,V):-decide(C,V,_).
decide(C,V,M):-
 ground(C),'.'(C,'cw:tx',Tx),'.'(Tx,message,Msg),'.'(Msg,sender,A),
 (admin(A)->'.'(C,intent,I),member(I,['gov:establish','gov:revise_constitution']),
   V='gov:permitted',M=reserved_controller;
  C=ctx{intent:I,commitment:K,actor:H,previous_state:J,stake:L,now:O,
        'gov:module':_,'cw:tx':_},
  small(H),small(J),small(L),small(O),'.'(Msg,funds,[]),
  atom(I),atom_length(I,Z),Z=<32,b(K),
  '.'(Tx,block,Block),'.'(Block,time_seconds,T),integer(T),T>=0,
  status(1,Hash),previous(A,Hash,P,S),
  (I=qualify->X=qualify(K);I=revoke->X=revoke;X=unrelated),
  staking_bonded_delegated_balance(A,coin(uaxone,Amount)),integer(Amount),Amount>=0,
  p(S,X,Amount,T,F,N),V=entitlement_v1(A,P,F,N),M=native_snapshot).
small(A):-atom(A),atom_length(A,N),N=<16.

status(R,H):-
 ask('{"module":{"constitution_status":{}}}',json(F)),
 member(constitution_revision=V,F),R is round(V),R=:=V,
 member(constitution_hash=H,F),atom(H).
previous(A,H,P,S):-
 atom_codes('{"module":{"decisions_by_author":{"author":"',B),atom_codes(A,C),
 atom_codes('","limit":1,"descending":true}}}',D),
 append(B,C,E),append(E,D,Q),ask_bytes(Q,json(F)),member(decisions=L,F),
 prior(L,A,H,P,S).
prior([],_,_,0,s(none,read_only,none,none)).
prior([json(F)],A,H,P,S):-
 member(author=A,F),member(constitution_hash=H,F),member(constitution_revision=R,F),R=:=1,
 member(decision_id=V,F),P is round(V),P=:=V,
 member(verdict=Text,F),atom(Text),atom_length(Text,Z),Z=<256,
 term_to_atom(T,Text),ground(T),T=entitlement_v1(A,Parent,Event,S),
 integer(Parent),Parent>=0,Parent<P,
 member(Event,[admitted,renewed,grace,disqualified,refused,unchanged,revoked]),v(S).
ask(A,R):-atom_codes(A,B),ask_bytes(B,R).
ask_bytes(Q,R):-gov(G),wasm_query(G,Q,B),json_decode_bytes(compact,B,R).
